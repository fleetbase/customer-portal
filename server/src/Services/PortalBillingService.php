<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Support\Utils;

class PortalBillingService
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function isAvailable(): bool
    {
        return class_exists(\Fleetbase\Ledger\Models\Invoice::class) && class_exists(\Fleetbase\Ledger\Http\Resources\v1\Invoice::class);
    }

    public function invoices(int $limit = 100): array
    {
        if (!$this->isAvailable()) {
            return [
                'available' => false,
                'invoices'  => [],
            ];
        }

        $context  = $this->accountResolver->resolve();
        $invoices = $this->accountInvoicesQuery($context)->latest()->limit($limit)->get();

        return [
            'available' => true,
            'invoices'  => \Fleetbase\Ledger\Http\Resources\v1\Invoice::collection($invoices)->resolve(),
        ];
    }

    public function invoice(string $id): array
    {
        abort_unless($this->isAvailable(), 404, 'Billing is not available for this customer portal.');

        $context = $this->accountResolver->resolve();
        $invoice = $this->accountInvoicesQuery($context)
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)->orWhere('public_id', $id);
            })
            ->firstOrFail();

        return [
            'available' => true,
            'invoice'   => (new \Fleetbase\Ledger\Http\Resources\v1\Invoice($invoice))->resolve(),
        ];
    }

    public function summary(): array
    {
        if (!$this->isAvailable()) {
            return [
                'available' => false,
                'balance'   => 0,
                'currency'  => null,
                'unpaid'    => 0,
            ];
        }

        $context = $this->accountResolver->resolve();
        $query   = $this->accountInvoicesQuery($context)->whereNotIn('status', ['paid', 'void', 'cancelled']);

        return [
            'available' => true,
            'balance'   => (clone $query)->sum('balance'),
            'currency'  => (clone $query)->value('currency'),
            'unpaid'    => (clone $query)->count(),
        ];
    }

    protected function accountInvoicesQuery(array $context)
    {
        return \Fleetbase\Ledger\Models\Invoice::where('company_uuid', session('company'))
            ->where('customer_uuid', $context['account']->uuid)
            ->where('customer_type', Utils::getMutationType($context['account']));
    }
}
