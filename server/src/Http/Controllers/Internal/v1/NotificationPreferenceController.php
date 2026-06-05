<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function preferences()
    {
        $context = $this->accountResolver->resolve();

        return response()->json([
            'preferences' => data_get($context['account'], 'meta.customer_portal.notification_preferences', []),
        ]);
    }

    public function savePreferences(Request $request)
    {
        $context     = $this->accountResolver->resolve();
        $preferences = (array) $request->input('preferences', []);
        $meta        = (array) data_get($context['account'], 'meta', []);
        data_set($meta, 'customer_portal.notification_preferences', $preferences);
        $context['account']->update(['meta' => $meta]);

        return response()->json(['preferences' => $preferences]);
    }
}
