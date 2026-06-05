<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\CustomerPortal\Services\PortalBillingService;
use Fleetbase\CustomerPortal\Services\PortalSupportService;
use Fleetbase\Http\Controllers\Controller;

class DashboardController extends Controller
{
    public function __construct(
        protected PortalAccountResolver $accountResolver,
        protected PortalBillingService $billingService,
        protected PortalSupportService $supportService,
    ) {
    }

    public function pendingActions()
    {
        $context = $this->accountResolver->resolve();
        $actions = [];

        $billing        = $this->billingService->summary();
        $unpaidInvoices = (int) data_get($billing, 'unpaid', 0);
        if ($unpaidInvoices > 0) {
            $actions[] = [
                'title'       => $unpaidInvoices . ' unpaid ' . ($unpaidInvoices === 1 ? 'invoice' : 'invoices'),
                'description' => 'Review outstanding billing for this account.',
                'icon'        => 'file-invoice-dollar',
                'type'        => 'billing',
                'route'       => 'portal.billing',
            ];
        }

        $openIssues = $this->supportService->queryForAccount($context)->whereNotIn('status', ['resolved', 'closed'])->count();
        if ($openIssues > 0) {
            $actions[] = [
                'title'       => $openIssues . ' open support ' . ($openIssues === 1 ? 'ticket' : 'tickets'),
                'description' => 'Support is reviewing your open requests.',
                'icon'        => 'headset',
                'type'        => 'support',
                'route'       => 'portal.support',
            ];
        }

        return response()->json(['actions' => $actions]);
    }
}
