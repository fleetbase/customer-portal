<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Vendor;
use Fleetbase\FleetOps\Models\VendorPersonnel;
use Fleetbase\FleetOps\Support\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PortalCustomerConversionService
{
    public function __construct(
        protected PortalOrderService $orderService,
        protected PortalSupportService $supportService,
    ) {
    }

    public function convertContactToVendor(Contact $contact, Request $request): Vendor
    {
        return DB::transaction(function () use ($contact, $request) {
            $originalType = $contact->type;
            $vendor       = Vendor::create([
                'company_uuid' => $contact->company_uuid,
                'place_uuid'   => $contact->place_uuid,
                'name'         => $request->input('name', $contact->name),
                'email'        => $request->input('email', $contact->email),
                'phone'        => $request->input('phone', $contact->phone),
                'status'       => 'active',
                'type'         => 'customer',
                'meta'         => [
                    'converted_from_contact_uuid' => $contact->uuid,
                    'converted_from_contact_type' => $originalType,
                    'converted_by_uuid'           => session('user'),
                    'converted_at'                => now()->toISOString(),
                ],
            ]);

            VendorPersonnel::updateOrCreate(
                ['vendor_uuid' => $vendor->uuid, 'contact_uuid' => $contact->uuid],
                ['role' => 'admin', 'status' => 'active', 'invited_by_uuid' => session('user')]
            );

            $vendorType = Utils::getMutationType($vendor);
            $this->orderService->migrateCustomerOwnership($contact, $vendor, $vendorType);
            $this->supportService->migrateCustomerOwnership($contact, $vendor);

            $contact->update([
                'type' => 'customer',
                'meta' => array_merge((array) $contact->meta, [
                    'converted_from_type'            => $originalType,
                    'converted_to_vendor_uuid'       => $vendor->uuid,
                    'converted_to_vendor_public_id'  => $vendor->public_id,
                    'converted_to_vendor_at'         => now()->toISOString(),
                ]),
            ]);

            return $vendor;
        });
    }
}
