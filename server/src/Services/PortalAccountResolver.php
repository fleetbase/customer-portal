<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Vendor;

class PortalAccountResolver
{
    public function resolve(): array
    {
        $userUuid    = session('user');
        $companyUuid = session('company');

        // A user can be a customer of more than one company; only accounts in the
        // session company may act as the portal account.
        $contact  = Contact::where(['company_uuid' => $companyUuid, 'user_uuid' => $userUuid, 'type' => 'customer'])->first();
        $vendors  = Vendor::where('company_uuid', $companyUuid)->whereHas('vendorPersonnel', function ($query) use ($userUuid, $companyUuid) {
            $query->where('status', 'active')->whereHas('contact', function ($contactQuery) use ($userUuid, $companyUuid) {
                $contactQuery->where('company_uuid', $companyUuid)->where('user_uuid', $userUuid)->where('type', 'customer');
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
