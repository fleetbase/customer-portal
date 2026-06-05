<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\CustomerPortal\Services\PortalCustomerConversionService;
use Fleetbase\FleetOps\Http\Resources\v1\Vendor as VendorResource;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;

class CustomerConversionController extends Controller
{
    public function __construct(
        protected PortalCustomerConversionService $conversionService,
        protected PortalAccountResolver $accountResolver,
    ) {
    }

    public function convertCurrentContactToVendor(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $contact = $context['contact'] ?? null;

        abort_if(!$contact instanceof Contact, 422, 'A customer contact account is required before creating a company account.');

        $vendor = $this->conversionService->convertContactToVendor($contact, $request);

        return response()->json([
            'vendor' => (new VendorResource($vendor->load('personnels')))->resolve(),
        ]);
    }

    public function convertContactToVendor(Request $request, string $contactId)
    {
        $contact = Contact::where('company_uuid', session('company'))
            ->where(function ($query) use ($contactId) {
                $query->where('uuid', $contactId)
                    ->orWhere('public_id', $contactId)
                    ->orWhere('id', $contactId);
            })
            ->firstOrFail();

        $vendor = $this->conversionService->convertContactToVendor($contact, $request);

        return response()->json([
            'vendor' => (new VendorResource($vendor->load('personnels')))->resolve(),
        ]);
    }
}
