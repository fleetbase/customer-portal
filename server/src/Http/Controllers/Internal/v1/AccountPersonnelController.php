<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\FleetOps\Http\Resources\v1\Contact as ContactResource;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Vendor;
use Fleetbase\FleetOps\Models\VendorPersonnel;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AccountPersonnelController extends Controller
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function index()
    {
        $vendor = $this->resolveVendorAccount();

        $personnels = VendorPersonnel::where('vendor_uuid', $vendor->uuid)
            ->with('contact')
            ->latest()
            ->get()
            ->map(fn (VendorPersonnel $personnel) => $this->personnelPayload($personnel));

        return response()->json(['personnels' => $personnels->values()]);
    }

    public function candidates()
    {
        $context = $this->accountResolver->resolve();
        $vendor  = $this->resolveVendorAccount($context);

        $memberUuids = $vendor->vendorPersonnel()
            ->pluck('contact_uuid')
            ->filter()
            ->unique()
            ->values();

        $contacts = Contact::where('company_uuid', session('company'))
            ->where('type', 'customer')
            ->when($memberUuids->isNotEmpty(), fn ($query) => $query->whereNotIn('uuid', $memberUuids))
            ->orderBy('name')
            ->get()
            ->map(fn (Contact $contact) => (new ContactResource($contact))->resolve());

        return response()->json(['contacts' => $contacts->values()]);
    }

    public function store(Request $request)
    {
        $vendor  = $this->resolveVendorAccount();
        $contact = $this->resolveOrCreateContact($request);

        $exists = VendorPersonnel::where([
            'vendor_uuid'  => $vendor->uuid,
            'contact_uuid' => $contact->uuid,
        ])->exists();

        if ($exists) {
            return response()->error('This contact is already a member of this company account.', 422);
        }

        $personnel = VendorPersonnel::updateOrCreate(
            ['vendor_uuid' => $vendor->uuid, 'contact_uuid' => $contact->uuid],
            [
                'role'            => $request->input('role', 'member'),
                'status'          => $request->input('status', 'active'),
                'invited_by_uuid' => session('user'),
            ]
        );

        if ($request->boolean('create_login', true)) {
            $contact->createUser();
        }

        return response()->json([
            'personnel' => $this->personnelPayload($personnel->load('contact')),
        ]);
    }

    public function destroy(string $contactId)
    {
        $vendor  = $this->resolveVendorAccount();
        $contact = Contact::findByIdOrFail($contactId);

        VendorPersonnel::where(['vendor_uuid' => $vendor->uuid, 'contact_uuid' => $contact->uuid])->delete();

        return response()->json(['status' => 'ok']);
    }

    protected function resolveVendorAccount(?array $context = null): Vendor
    {
        $context ??= $this->accountResolver->resolve();

        abort_if($context['account_type'] !== 'vendor' || !$context['account'] instanceof Vendor, 403, 'A company customer account is required to manage personnel.');

        return $context['account'];
    }

    protected function resolveOrCreateContact(Request $request): Contact
    {
        $contactId = $request->input('contact');
        if ($contactId) {
            return Contact::where('company_uuid', session('company'))
                ->where('type', 'customer')
                ->where(function ($query) use ($contactId) {
                    $query->where('uuid', $contactId)->orWhere('public_id', $contactId);
                })
                ->firstOrFail();
        }

        return Contact::create([
            'company_uuid' => session('company'),
            'name'         => $request->input('name'),
            'email'        => $request->input('email'),
            'phone'        => $request->input('phone'),
            'type'         => 'customer',
        ]);
    }

    protected function personnelPayload(VendorPersonnel $personnel): array
    {
        $contact = $personnel->contact;

        return [
            'id'              => $contact?->public_id,
            'uuid'            => $contact?->uuid,
            'contact_uuid'    => $contact?->uuid,
            'public_id'       => $contact?->public_id,
            'name'            => $contact?->name,
            'email'           => $contact?->email,
            'phone'           => $contact?->phone,
            'photo_url'       => $contact?->photo_url,
            'role'            => $personnel->role ?? 'member',
            'status'          => $personnel->status ?? 'active',
            'invited_by_uuid' => $personnel->invited_by_uuid,
            'contact'         => $contact ? (new ContactResource($contact))->resolve() : null,
        ];
    }
}
