<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Vendor;

class PortalAccountResolver
{
    public function resolve(): array
    {
        $userUuid = session('user');
        $contact  = Contact::where(['user_uuid' => $userUuid, 'type' => 'customer'])->first();
        $vendors  = Vendor::whereHas('vendorPersonnel', function ($query) use ($userUuid) {
            $query->where('status', 'active')->whereHas('contact', function ($contactQuery) use ($userUuid) {
                $contactQuery->where('user_uuid', $userUuid)->where('type', 'customer');
            });
        })->get();

        $accounts = collect();
        if ($contact) {
            $accounts->push($this->accountPayload($contact, 'contact'));
        }
        foreach ($vendors as $vendor) {
            $accounts->push($this->accountPayload($vendor, 'vendor'));
        }

        $account     = $vendors->first() ?: $contact;
        $accountType = $account instanceof Vendor ? 'vendor' : 'contact';

        abort_if(!$account, 404, 'No customer account found for user account.');

        return [
            'contact'      => $contact,
            'account'      => $account,
            'account_type' => $accountType,
            'accounts'     => $accounts->values(),
        ];
    }

    protected function accountPayload($account, string $type): array
    {
        return [
            'id'            => $account->public_id,
            'uuid'          => $account->uuid,
            'name'          => $account->name,
            'customer_type' => $type,
        ];
    }
}
