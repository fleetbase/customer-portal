<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalBillingService;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(protected PortalBillingService $billingService)
    {
    }

    public function invoices(Request $request)
    {
        return response()->json($this->billingService->invoices((int) $request->input('limit', 100)));
    }

    public function invoice(string $id)
    {
        return response()->json($this->billingService->invoice($id));
    }

    public function summary()
    {
        return response()->json($this->billingService->summary());
    }
}
