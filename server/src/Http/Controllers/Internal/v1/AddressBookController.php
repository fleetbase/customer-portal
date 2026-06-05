<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\FleetOps\Http\Resources\v1\Contact as ContactResource;
use Fleetbase\FleetOps\Http\Resources\v1\Place as PlaceResource;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Controllers\Controller;

class AddressBookController extends Controller
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function addressBook()
    {
        $context = $this->accountResolver->resolve();
        $account = $context['account'];

        $places = Place::where('company_uuid', session('company'))
            ->where('owner_uuid', $account->uuid)
            ->where('owner_type', Utils::getMutationType($account))
            ->latest()
            ->limit(100)
            ->get();

        $contacts = $context['account_type'] === 'vendor'
            ? $account->personnels()->limit(100)->get()
            : collect([$context['contact']])->filter();

        return response()->json([
            'places'   => PlaceResource::collection($places)->resolve(),
            'contacts' => ContactResource::collection($contacts)->resolve(),
        ]);
    }
}
