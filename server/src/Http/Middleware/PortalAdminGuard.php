<?php

namespace Fleetbase\CustomerPortal\Http\Middleware;

use Fleetbase\Models\User;
use Fleetbase\Support\Auth;
use Illuminate\Http\Request;

/**
 * Restricts the portal's organization settings routes to console users.
 *
 * Portal customers authenticate with a Sanctum token for the same company, so the
 * `fleetbase.protected` group alone lets them reach these routes. AuthorizationGuard
 * cannot resolve a permission for a plain controller, so the check is made here.
 */
class PortalAdminGuard
{
    /**
     * @param string $action the `fleet-ops {action} customer` permission the route requires
     */
    public function handle(Request $request, \Closure $next, string $action = 'view')
    {
        $user = $request->user();

        if (!$user instanceof User || $user->isType('customer')) {
            return $this->refuse();
        }

        if ($user->isNotAdmin() && Auth::cannot("fleet-ops {$action} customer")) {
            return $this->refuse();
        }

        return $next($request);
    }

    protected function refuse()
    {
        return response()->error('User is not authorized to manage customer portal settings.', 403, ['code' => 'portal_admin_required']);
    }
}
