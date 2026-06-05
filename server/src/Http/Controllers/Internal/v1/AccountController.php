<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\FleetOps\Http\Resources\v1\Contact as ContactResource;
use Fleetbase\FleetOps\Http\Resources\v1\Vendor as VendorResource;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class AccountController extends Controller
{
    public function __construct(protected PortalAccountResolver $accountResolver)
    {
    }

    public function account()
    {
        $context = $this->accountResolver->resolve();

        return response()->json([
            'customer' => $context['contact'] ? (new ContactResource($context['contact']))->resolve() : null,
            'account'  => $this->resourceForAccount($context['account'], $context['account_type']),
            'accounts' => $context['accounts'],
        ]);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        abort_if(!$user || $user->type !== 'customer', 403, 'Only customer portal users can change their password from the customer portal.');

        $request->validate([
            'current_password'      => ['required', 'string'],
            'password'              => [
                'required',
                'confirmed',
                'string',
                Password::min(8)
                    ->mixedCase()
                    ->letters()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
            'password_confirmation' => ['required', 'string'],
        ], [
            'current_password.required' => 'The current password is required.',
            'password.required'         => 'You must enter a password.',
            'password.min'              => 'Password must be at least 8 characters.',
            'password.mixed'            => 'Password must contain both uppercase and lowercase letters.',
            'password.letters'          => 'Password must contain at least one letter.',
            'password.numbers'          => 'Password must contain at least one number.',
            'password.symbols'          => 'Password must contain at least one symbol.',
            'password.uncompromised'    => 'This password has appeared in a data breach. Please choose a different one.',
        ]);

        if (!$user->checkPassword($request->input('current_password'))) {
            return response()->error('The current password provided is invalid.', 422);
        }

        $user->changePassword($request->input('password'));

        return response()->json(['status' => 'ok']);
    }

    protected function resourceForAccount($account, string $type): ?array
    {
        if (!$account) {
            return null;
        }

        if ($type === 'vendor') {
            return array_merge((new VendorResource($account->loadMissing('personnels')))->resolve(), ['customer_type' => 'vendor']);
        }

        return array_merge((new ContactResource($account))->resolve(), ['customer_type' => 'contact']);
    }
}
