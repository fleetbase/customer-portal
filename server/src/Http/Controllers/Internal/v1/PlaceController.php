<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\FleetOps\Http\Resources\v1\Place as PlaceResource;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Support\PlaceSearch;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\LaravelMysqlSpatial\Types\Point;
use Illuminate\Http\Request;

class PlaceController extends Controller
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function search(Request $request)
    {
        $context     = $this->accountResolver->resolve();
        $searchQuery = $request->input('query');
        $limit       = $request->input('limit', 25);
        $geo         = $request->boolean('geo');
        $latitude    = $request->input('latitude');
        $longitude   = $request->input('longitude');
        $query       = $this->accountPlacesQuery($context);

        $results = PlaceSearch::search($query, $searchQuery, [
            'limit'          => $limit,
            'geo'            => $geo,
            'latitude'       => $latitude,
            'longitude'      => $longitude,
            'no_query_order' => 'latest',
        ]);

        return response()->json([
            'places' => PlaceResource::collection($results)->resolve(),
        ]);
    }

    public function lookup(Request $request)
    {
        $query = $request->input('query');

        if (!$query) {
            return response()->json([]);
        }

        $results = PlaceSearch::geocode($query, $request->input('latitude'), $request->input('longitude'));

        return response()->json(PlaceResource::collection($results)->resolve());
    }

    public function create(Request $request)
    {
        $request->validate([
            'name'      => ['nullable', 'string'],
            'street1'   => ['nullable', 'string'],
            'address'   => ['nullable', 'string'],
            'phone'     => ['nullable', 'string'],
            'latitude'  => ['nullable', 'required_with:longitude'],
            'longitude' => ['nullable', 'required_with:latitude'],
        ]);

        $context = $this->accountResolver->resolve();
        $account = $context['account'];
        $street1 = $request->input('street1') ?: $request->input('address');

        if (!$street1 && !$request->filled(['latitude', 'longitude'])) {
            return response()->apiError('A street address or coordinates are required.');
        }

        $input = $this->placeInput($request);

        $input['street1']      = $street1;
        $input['company_uuid'] = session('company');
        $input['owner_uuid']   = $account->uuid;
        $input['owner_type']   = Utils::getMutationType($account);

        if ($request->filled(['latitude', 'longitude'])) {
            $input['location'] = Utils::getPointFromCoordinates($request->only(['latitude', 'longitude']));
        }

        if (empty($input['location']) && $street1) {
            $geocoded = Place::createFromGeocodingLookup($street1);

            if ($geocoded instanceof Place) {
                $input = array_merge($geocoded->toArray(), array_filter($input, fn ($value) => $value !== null && $value !== ''));
            }
        }

        if (empty($input['location'])) {
            $input['location'] = new Point(0, 0);
        }

        $place = Place::firstOrNew([
            'company_uuid' => session('company'),
            'owner_uuid'   => $account->uuid,
            'owner_type'   => Utils::getMutationType($account),
            'name'         => strtoupper($input['name'] ?: $input['street1']),
            'street1'      => strtoupper($input['street1']),
        ]);

        $place->fill($input);

        if ($place->location instanceof Point && $place->location->getLat() === 0.0 && $place->location->getLng() === 0.0 && $street1) {
            $geocoded = Geocoder::geocode($place->toAddressString(['name']))->get()->first();

            if ($geocoded) {
                $place->fillWithGoogleAddress($geocoded);
            }
        }

        $place->save();

        return response()->json([
            'place' => (new PlaceResource($place))->resolve(),
        ]);
    }

    public function update($id, Request $request)
    {
        $request->validate([
            'name'      => ['nullable', 'string'],
            'street1'   => ['nullable', 'string'],
            'address'   => ['nullable', 'string'],
            'phone'     => ['nullable', 'string'],
            'latitude'  => ['nullable', 'required_with:longitude'],
            'longitude' => ['nullable', 'required_with:latitude'],
        ]);

        $context = $this->accountResolver->resolve();
        $place   = $this->findAccountPlace($id, $context);
        $input   = $this->placeInput($request);
        $street1 = $request->input('street1') ?: $request->input('address');

        if ($street1) {
            $input['street1'] = $street1;
        }

        if ($request->filled(['latitude', 'longitude'])) {
            $input['location'] = Utils::getPointFromCoordinates($request->only(['latitude', 'longitude']));
        }

        $place->fill(array_filter($input, fn ($value) => $value !== null && $value !== ''));
        $place->save();

        return response()->json([
            'place' => (new PlaceResource($place))->resolve(),
        ]);
    }

    public function delete($id)
    {
        $context = $this->accountResolver->resolve();
        $place   = $this->findAccountPlace($id, $context);

        $place->delete();

        return response()->json(['status' => 'ok']);
    }

    protected function findAccountPlace($id, array $context): Place
    {
        return Place::where('company_uuid', session('company'))
            ->where('owner_uuid', $context['account']->uuid)
            ->where('owner_type', Utils::getMutationType($context['account']))
            ->where(function ($query) use ($id) {
                $query->where('public_id', $id)->orWhere('uuid', $id);
            })
            ->firstOrFail();
    }

    protected function accountPlacesQuery(array $context)
    {
        return Place::where('company_uuid', session('company'))
            ->where('owner_uuid', $context['account']->uuid)
            ->where('owner_type', Utils::getMutationType($context['account']));
    }

    protected function placeInput(Request $request): array
    {
        return $request->only([
            'name',
            'street1',
            'street2',
            'city',
            'province',
            'postal_code',
            'neighborhood',
            'district',
            'building',
            'security_access_code',
            'country',
            'phone',
            'type',
            'meta',
        ]);
    }
}
