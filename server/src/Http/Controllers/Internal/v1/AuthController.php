<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Http\Requests\LoginRequest;
use Fleetbase\Models\User;
use Fleetbase\Support\Auth;
use Fleetbase\Support\TwoFactorAuth;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * Authenticates customer portal users only.
     */
    public function login(LoginRequest $request)
    {
        $identity  = $request->input('identity');
        $password  = $request->input('password');
        $authToken = $request->input('authToken');

        if ($authToken) {
            $personalAccessToken = PersonalAccessToken::findToken($authToken);

            if ($personalAccessToken) {
                $personalAccessToken->loadMissing('tokenable');
                $tokenOwner = $personalAccessToken->tokenable;

                if (
                    $tokenOwner instanceof User
                    && ($tokenOwner->email === $identity || $tokenOwner->phone === $identity)
                ) {
                    if ($tokenOwner->type !== 'customer') {
                        return response()->error('Console users must sign in through the Fleetbase console.', 403, ['code' => 'console_login_not_allowed']);
                    }

                    return response()->json([
                        'token' => $authToken,
                        'type'  => $tokenOwner->getType(),
                    ]);
                }
            }
        }

        $user = User::where(function ($query) use ($identity) {
            $query->where('email', $identity)->orWhere('phone', $identity);
        })->first();

        if ($user && $user->type !== 'customer') {
            return response()->error('Console users must sign in through the Fleetbase console.', 403, ['code' => 'console_login_not_allowed']);
        }

        if (!$user) {
            return response()->error('These credentials do not match our records.', 401, ['code' => 'invalid_credentials']);
        }

        if (empty($user->password)) {
            return response()->error('Password reset required to continue.', 400, ['code' => 'reset_password']);
        }

        if (Auth::isInvalidPassword($password, $user->password)) {
            return response()->error('These credentials do not match our records.', 401, ['code' => 'invalid_credentials']);
        }

        if (TwoFactorAuth::isEnabled($user)) {
            $twoFaSession = TwoFactorAuth::start($user);

            return response()->json([
                'twoFaSession' => $twoFaSession,
                'isEnabled'    => true,
            ]);
        }

        if ($user->isNotVerified() && $user->isNotAdmin()) {
            return response()->error('User is not verified.', 400, ['code' => 'not_verified']);
        }

        $user->updateLastLogin();
        $token = $user->createToken($user->uuid);

        return response()->json(['token' => $token->plainTextToken, 'type' => $user->getType()]);
    }
}
