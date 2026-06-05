<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\CustomerPortal\Services\PortalConfigService;
use Fleetbase\CustomerPortal\Services\PortalOrderService;
use Fleetbase\FleetOps\Http\Controllers\Internal\v1\ServiceQuoteController as FleetOpsServiceQuoteController;
use Fleetbase\FleetOps\Http\Resources\v1\ServiceQuote as ServiceQuoteResource;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Models\PurchaseRate;
use Fleetbase\FleetOps\Models\ServiceQuote;
use Fleetbase\FleetOps\Models\ServiceRate;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class ServiceQuoteController extends Controller
{
    public function __construct(
        protected PortalAccountResolver $accountResolver,
        protected PortalOrderService $orderService,
        protected PortalConfigService $portalConfig,
        protected FleetOpsServiceQuoteController $fleetOpsServiceQuotes,
    ) {
    }

    public function preliminary(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $payload = $this->portalPayload($request, $context);

        if ($this->stopCount($payload) < 2) {
            return response()->apiError('Pickup and dropoff or at least two waypoints are required.');
        }

        $request->merge([
            'payload'            => $payload,
            'service_type'       => $request->input('service_type'),
            'scheduled_at'       => $request->input('scheduled_at'),
            'currency'           => $request->input('currency'),
            'cod'                => $request->input('cod'),
            'is_route_optimized' => $request->boolean('is_route_optimized', true),
            'single'             => $request->boolean('single', false),
        ]);

        $quoteIds = $this->queryAllowedServiceQuotes($request);
        $this->markQuotesForPortal($quoteIds, $context);

        $quotes = ServiceQuote::with(['items', 'serviceRate'])
            ->whereIn('uuid', $quoteIds)
            ->get()
            ->sortBy(fn ($quote) => array_search($quote->uuid, $quoteIds, true))
            ->values();

        return response()->json([
            'service_quotes' => ServiceQuoteResource::collection($quotes)->resolve(),
        ]);
    }

    protected function queryAllowedServiceQuotes(Request $request): array
    {
        $enabledServiceRateIds = $this->portalConfig->enabledServiceRateIds();

        if (is_array($enabledServiceRateIds) && count($enabledServiceRateIds) === 0) {
            return [];
        }

        if (!is_array($enabledServiceRateIds)) {
            $request->merge(['service' => $request->input('service', 'all')]);

            $response = $this->fleetOpsServiceQuotes->preliminaryQuery($request);
            if ($response->getStatusCode() >= 400) {
                abort($response->getStatusCode(), implode(' ', data_get($response->getData(true), 'errors', [])));
            }

            return $this->quoteIdsFromResponse($response->getData(true));
        }

        $serviceRateUuids = ServiceRate::where('company_uuid', session('company'))
            ->where(function ($query) use ($enabledServiceRateIds) {
                $query->whereIn('uuid', $enabledServiceRateIds)->orWhereIn('public_id', $enabledServiceRateIds);
            })
            ->pluck('uuid')
            ->values()
            ->all();

        $quoteIds = [];
        foreach ($serviceRateUuids as $serviceRateUuid) {
            $quoteRequest = clone $request;
            $quoteRequest->merge(['service' => $serviceRateUuid, 'single' => false]);
            $response = $this->fleetOpsServiceQuotes->preliminaryQuery($quoteRequest);

            if ($response->getStatusCode() >= 400) {
                abort($response->getStatusCode(), implode(' ', data_get($response->getData(true), 'errors', [])));
            }

            $quoteIds = array_merge($quoteIds, $this->quoteIdsFromResponse($response->getData(true)));
        }

        return array_values(array_unique($quoteIds));
    }

    public function createStripeCheckoutSession(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $quote   = $this->resolvePortalQuote($request->input('service_quote'), $context);

        if (!$quote) {
            return response()->apiError('The service quote to purchase does not exist.');
        }

        $request->merge(['service_quote' => $quote->uuid]);

        return $this->fleetOpsServiceQuotes->createStripeCheckoutSession($request);
    }

    public function getStripeCheckoutSessionStatus(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $quote   = $this->resolvePortalQuote($request->input('service_quote'), $context);

        if (!$quote) {
            return response()->apiError('The service quote to purchase does not exist.');
        }

        $request->merge(['service_quote' => $quote->uuid]);
        $response = $this->fleetOpsServiceQuotes->getStripeCheckoutSessionStatus($request);

        if ($response->getStatusCode() < 400) {
            $data             = $response->getData(true);
            $purchaseRate     = data_get($data, 'purchaseRate');
            $purchaseRateUuid = data_get($purchaseRate, 'uuid');

            if (!$purchaseRateUuid) {
                $purchaseRateUuid = PurchaseRate::where('company_uuid', session('company'))
                    ->where('service_quote_uuid', $quote->uuid)
                    ->value('uuid');
            }

            if ($purchaseRateUuid) {
                $purchaseRate = PurchaseRate::with(['serviceQuote.items'])
                    ->where('uuid', $purchaseRateUuid)
                    ->first();

                $purchaseRate?->update([
                    'customer_uuid' => $context['account']->uuid,
                    'customer_type' => Utils::getMutationType($context['account']),
                ]);

                $data['purchaseRate'] = $purchaseRate?->fresh(['serviceQuote.items'])?->toArray();

                return response()->json($data);
            }
        }

        return $response;
    }

    protected function portalPayload(Request $request, array $context): array
    {
        $payload = (array) $request->input('payload', []);

        return [
            'pickup'    => $this->placePayload($this->resolvePlace(Arr::get($payload, 'pickup', $request->input('pickup')), $context)),
            'dropoff'   => $this->placePayload($this->resolvePlace(Arr::get($payload, 'dropoff', $request->input('dropoff')), $context)),
            'return'    => $this->placePayload($this->resolvePlace(Arr::get($payload, 'return', $request->input('return')), $context)),
            'waypoints' => $this->waypointPayloads(Arr::get($payload, 'waypoints', $request->input('waypoints', [])), $context),
            'entities'  => array_values(array_filter(Arr::get($payload, 'entities', $request->input('entities', [])))),
        ];
    }

    protected function resolvePlace($place, array $context): ?Place
    {
        if (!$place) {
            return null;
        }

        return $this->orderService->resolveAccountPlace($place, $context);
    }

    protected function waypointPayloads(array $waypoints, array $context): array
    {
        return collect($waypoints)
            ->map(function ($waypoint) use ($context) {
                $place = $this->resolvePlace(data_get($waypoint, 'place', $waypoint), $context);

                if (!$place) {
                    return null;
                }

                return [
                    ...$this->placePayload($place),
                    'type' => data_get($waypoint, 'type', 'dropoff'),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    protected function placePayload(?Place $place): ?array
    {
        if (!$place) {
            return null;
        }

        return [
            'uuid'        => $place->uuid,
            'public_id'   => $place->public_id,
            'name'        => $place->name,
            'address'     => $place->address,
            'street1'     => $place->street1,
            'street2'     => $place->street2,
            'city'        => $place->city,
            'province'    => $place->province,
            'postal_code' => $place->postal_code,
            'country'     => $place->country,
            'latitude'    => $place->latitude,
            'longitude'   => $place->longitude,
            'location'    => $place->location,
        ];
    }

    protected function stopCount(array $payload): int
    {
        return (int) filled(data_get($payload, 'pickup')) + (int) filled(data_get($payload, 'dropoff')) + count(data_get($payload, 'waypoints', []));
    }

    protected function quoteIdsFromResponse(array $data): array
    {
        $quotes = Arr::isAssoc($data) ? [$data] : $data;

        return collect($quotes)
            ->map(fn ($quote) => data_get($quote, 'uuid'))
            ->filter()
            ->values()
            ->all();
    }

    protected function markQuotesForPortal(array $quoteIds, array $context): void
    {
        ServiceQuote::whereIn('uuid', $quoteIds)->get()->each(function (ServiceQuote $quote) use ($context) {
            $quote->updateMeta('customer_portal', [
                'account_uuid'    => $context['account']->uuid,
                'account_type'    => Utils::getMutationType($context['account']),
                'created_by_uuid' => session('user'),
                'created_at'      => now()->toISOString(),
            ]);
        });
    }

    protected function resolvePortalQuote($id, array $context): ?ServiceQuote
    {
        if (!$id) {
            return null;
        }

        return ServiceQuote::where('company_uuid', session('company'))
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)->orWhere('public_id', $id);
            })
            ->where('meta->customer_portal->account_uuid', $context['account']->uuid)
            ->where('meta->customer_portal->account_type', Utils::getMutationType($context['account']))
            ->first();
    }
}
