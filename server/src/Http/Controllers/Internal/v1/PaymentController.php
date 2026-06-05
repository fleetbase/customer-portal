<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalConfigService;
use Fleetbase\Http\Controllers\Controller;

class PaymentController extends Controller
{
    public function __construct(protected PortalConfigService $portalConfig)
    {
    }

    public function config()
    {
        return response()->json($this->portalConfig->paymentsConfig());
    }
}
