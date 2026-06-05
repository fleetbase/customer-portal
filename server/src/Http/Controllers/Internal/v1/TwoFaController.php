<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Http\Requests\TwoFaValidationRequest;
use Fleetbase\Models\User;
use Fleetbase\Support\TwoFactorAuth;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class TwoFaController extends Controller
{
    /**
     * Check customer two-factor authentication status.
     */
    public function checkTwoFactor(Request $request)
    {
        $identity = $request->input('identity');
        $this->resolveCustomerByIdentity($identity);

        $twoFaSession   = TwoFactorAuth::createTwoFaSessionIfEnabled($identity);
        $isTwoFaEnabled = $twoFaSession !== null;

        return response()->json([
            'twoFaSession'   => $twoFaSession,
            'isTwoFaEnabled' => $isTwoFaEnabled,
        ]);
    }

    /**
     * Validate a customer two-factor authentication session.
     */
    public function validateSession(TwoFaValidationRequest $request)
    {
        $token       = $request->input('token');
        $identity    = $request->input('identity');
        $clientToken = $request->input('clientToken');

        $this->resolveCustomerByIdentity($identity);

        try {
            $validClientToken = TwoFactorAuth::getClientSessionTokenFromTwoFaSession($token, $identity, $clientToken);

            return response()->json([
                'clientToken' => $validClientToken,
                'expired'     => false,
            ]);
        } catch (\Exception $e) {
            $errorMessage = $e->getMessage();

            if (Str::contains($errorMessage, ['2FA Verification', 'expired'])) {
                return response()->json([
                    'expired' => true,
                ]);
            }

            return response()->error($errorMessage);
        }
    }

    /**
     * Verify a customer two-factor authentication code.
     */
    public function verifyCode(Request $request)
    {
        $code        = $request->input('code');
        $token       = $request->input('token');
        $clientToken = $request->input('clientToken');

        try {
            $authToken           = TwoFactorAuth::verifyCode($code, $token, $clientToken);
            $personalAccessToken = PersonalAccessToken::findToken($authToken);
            $tokenOwner          = $personalAccessToken?->tokenable;

            if (!$tokenOwner instanceof User || $tokenOwner->type !== 'customer') {
                $personalAccessToken?->delete();

                if ($tokenOwner instanceof User) {
                    return response()->error('Console users must sign in through the Fleetbase console.', 403, ['code' => 'console_login_not_allowed']);
                }

                return response()->error('These credentials do not match our records.', 401, ['code' => 'invalid_credentials']);
            }

            return response()->json([
                'authToken' => $authToken,
            ]);
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    /**
     * Resend a customer two-factor authentication verification code.
     */
    public function resendCode(Request $request)
    {
        $identity = $request->input('identity');
        $token    = $request->input('token');

        $this->resolveCustomerByIdentity($identity);

        try {
            $clientToken = TwoFactorAuth::resendCode($identity, $token);

            return response()->json([
                'clientToken' => $clientToken,
            ]);
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    /**
     * Invalidate a customer two-factor authentication session.
     */
    public function invalidateSession(Request $request)
    {
        $identity = $request->input('identity');
        $token    = $request->input('token');

        $this->resolveCustomerByIdentity($identity);

        try {
            $ok = TwoFactorAuth::forgetTwoFaSession($token, $identity);

            return response()->json([
                'ok' => $ok,
            ]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false]);
        }
    }

    protected function resolveCustomerByIdentity(?string $identity): User
    {
        if (!$identity) {
            abort(401, 'These credentials do not match our records.');
        }

        $user = User::where(function ($query) use ($identity) {
            $query->where('email', $identity)->orWhere('phone', $identity);
        })->first();

        if (!$user || $user->type !== 'customer') {
            if ($user) {
                throw new HttpResponseException(response()->error('Console users must sign in through the Fleetbase console.', 403, ['code' => 'console_login_not_allowed']));
            }

            abort(401, 'These credentials do not match our records.');
        }

        return $user;
    }
}
