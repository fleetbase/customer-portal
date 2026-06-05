<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Models\Entity;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Models\Payload;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Models\Waypoint;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\LaravelMysqlSpatial\Types\Point;
use Illuminate\Http\Request;

class PortalOrderService
{
    public function queryForAccount(array $context)
    {
        $accountCustomerFilters = $this->accountCustomerFilters($context);

        return Order::where('company_uuid', session('company'))
            ->where(function ($query) use ($accountCustomerFilters) {
                if (empty($accountCustomerFilters)) {
                    $query->whereRaw('1 = 0');

                    return;
                }

                foreach ($accountCustomerFilters as $filter) {
                    $query->orWhere(function ($accountQuery) use ($filter) {
                        $accountQuery
                            ->where('customer_uuid', $filter['uuid'])
                            ->where('customer_type', $filter['type']);
                    });
                }
            })
            ->whereNull('deleted_at')
            ->withoutGlobalScopes();
    }

    public function resolveOrder(string $id, array $context): Order
    {
        return $this->queryForAccount($context)
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)->orWhere('public_id', $id);
            })
            ->firstOrFail();
    }

    public function resolveOrderUuid($order, array $context): ?string
    {
        $orderId = is_array($order) ? data_get($order, 'uuid', data_get($order, 'id')) : $order;
        if (!$orderId) {
            return null;
        }

        return $this->queryForAccount($context)
            ->where(function ($query) use ($orderId) {
                $query->where('uuid', $orderId)->orWhere('public_id', $orderId);
            })
            ->value('uuid');
    }

    public function resolveOrderConfig(Request $request): ?OrderConfig
    {
        $orderConfigId = $request->input('order_config', $request->input('type'));
        if ($orderConfigId) {
            $orderConfig = OrderConfig::where('company_uuid', session('company'))
                ->where(function ($query) use ($orderConfigId) {
                    $query->where('uuid', $orderConfigId)->orWhere('public_id', $orderConfigId)->orWhere('key', $orderConfigId);
                })
                ->first();

            if ($orderConfig) {
                return $orderConfig;
            }
        }

        return OrderConfig::where('company_uuid', session('company'))->first();
    }

    public function buildPayloadFromInput(array $payloadInput, array $context): Payload
    {
        $payload   = new Payload();
        $entities  = data_get($payloadInput, 'entities', []);
        $waypoints = data_get($payloadInput, 'waypoints', []);
        $pickup    = $this->resolveAccountPlace(data_get($payloadInput, 'pickup'), $context);
        $dropoff   = $this->resolveAccountPlace(data_get($payloadInput, 'dropoff'), $context);
        $return    = $this->resolveAccountPlace(data_get($payloadInput, 'return'), $context);
        $waypoints = $this->resolveAccountWaypoints($waypoints, $context);

        $payload->company_uuid = session('company');

        if ($pickup) {
            $payload->setPickup($pickup, [
                'callback' => function ($pickup, $payload) {
                    $payload->setCurrentWaypoint($pickup);
                },
            ]);
        }

        if ($dropoff) {
            $payload->setDropoff($dropoff);
        }

        if ($return) {
            $payload->setReturn($return);
        }

        $payload->save();
        $payload->setWaypoints($waypoints);
        $payload->setEntities($entities);

        $firstWaypoint = $payload->getPickupOrFirstWaypoint();
        if ($firstWaypoint instanceof Place) {
            $payload->setCurrentWaypoint($firstWaypoint);
        }

        return $payload;
    }

    public function resolveAccountWaypoints(array $waypoints, array $context): array
    {
        return collect($waypoints)
            ->map(function ($waypoint) use ($context) {
                $placeInput = data_get($waypoint, 'place', $waypoint);
                $place      = $this->resolveAccountPlace($placeInput, $context);

                if (!$place instanceof Place) {
                    return null;
                }

                return [
                    ...$waypoint,
                    'place'      => $place,
                    'place_uuid' => $place->uuid,
                    'type'       => data_get($waypoint, 'type', 'dropoff'),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    public function resolveAccountPlace($place, array $context): ?Place
    {
        if (!$place) {
            return null;
        }

        if ($place instanceof Place) {
            return $this->ensureAccountPlace($place, $context);
        }

        if (!is_array($place)) {
            return $this->findAccountPlaceByIdentifier($place, $context);
        }

        $identifier = data_get($place, 'uuid', data_get($place, 'id', data_get($place, 'public_id')));
        if ($identifier && ($existingPlace = $this->findAccountPlaceByIdentifier($identifier, $context))) {
            return $existingPlace;
        }

        $values = $this->accountPlaceValues($place, $context);

        $existingPlace = $this->findMatchingAccountPlace($values, $context);
        if ($existingPlace instanceof Place) {
            $existingPlace->fill(array_filter($values, fn ($value) => $value !== null && $value !== ''));
            $existingPlace->save();

            return $existingPlace;
        }

        $place = new Place();
        $place->fill($values);
        $place->save();

        return $place;
    }

    public function ensureAccountPlace(Place $place, array $context): Place
    {
        $account = $context['account'];

        if ($place->owner_uuid === $account->uuid && $place->owner_type === Utils::getMutationType($account)) {
            return $place;
        }

        return $this->resolveAccountPlace($place->toArray(), $context);
    }

    protected function findAccountPlaceByIdentifier($identifier, array $context): ?Place
    {
        return Place::where('company_uuid', session('company'))
            ->where('owner_uuid', $context['account']->uuid)
            ->where('owner_type', Utils::getMutationType($context['account']))
            ->where(function ($query) use ($identifier) {
                $query->where('uuid', $identifier)->orWhere('public_id', $identifier);
            })
            ->first();
    }

    protected function findMatchingAccountPlace(array $values, array $context): ?Place
    {
        $street1 = data_get($values, 'street1');
        $city    = data_get($values, 'city');
        $country = data_get($values, 'country');

        if (!$street1) {
            return null;
        }

        return Place::where('company_uuid', session('company'))
            ->where('owner_uuid', $context['account']->uuid)
            ->where('owner_type', Utils::getMutationType($context['account']))
            ->where('street1', $street1)
            ->when($city, fn ($query) => $query->where('city', $city))
            ->when($country, fn ($query) => $query->where('country', $country))
            ->first();
    }

    protected function accountPlaceValues(array $place, array $context): array
    {
        $account = $context['account'];
        $values  = Place::mergeStructuredPlaceAttributes($place);
        $street1 = data_get($values, 'street1', data_get($values, 'address'));

        $values['street1']      = $street1;
        $values['company_uuid'] = session('company');
        $values['owner_uuid']   = $account->uuid;
        $values['owner_type']   = Utils::getMutationType($account);

        if (empty($values['location'])) {
            $values['location'] = new Point(0, 0);
        }

        return $values;
    }

    protected function accountCustomerFilters(array $context): array
    {
        $filters = collect();

        if ($context['contact'] ?? null) {
            $filters->push([
                'uuid' => $context['contact']->uuid,
                'type' => Utils::getMutationType($context['contact']),
            ]);
        }

        if ($context['account'] ?? null) {
            $filters->push([
                'uuid' => $context['account']->uuid,
                'type' => Utils::getMutationType($context['account']),
            ]);
        }

        foreach ($context['accounts'] ?? [] as $account) {
            $uuid = data_get($account, 'uuid');
            $type = data_get($account, 'customer_type');

            if ($uuid && $type) {
                $filters->push([
                    'uuid' => $uuid,
                    'type' => Utils::getMutationType('fleet-ops:' . $type),
                ]);
            }
        }

        return $filters
            ->filter(fn ($filter) => filled($filter['uuid']) && filled($filter['type']))
            ->unique(fn ($filter) => $filter['uuid'] . ':' . $filter['type'])
            ->values()
            ->all();
    }

    public function migrateCustomerOwnership($contact, $vendor, string $vendorType): void
    {
        $contactType = Utils::getMutationType($contact);
        $filter      = ['customer_uuid' => $contact->uuid, 'customer_type' => $contactType];
        $replacement = ['customer_uuid' => $vendor->uuid, 'customer_type' => $vendorType];

        Order::where($filter)->update($replacement);
        \Fleetbase\FleetOps\Models\PurchaseRate::where($filter)->update($replacement);
        Entity::where($filter)->update($replacement);
        Waypoint::where($filter)->update($replacement);
        Place::where('owner_uuid', $contact->uuid)->update(['owner_uuid' => $vendor->uuid, 'owner_type' => $vendorType]);
    }
}
