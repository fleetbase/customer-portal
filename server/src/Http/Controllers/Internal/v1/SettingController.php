<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalConfigService;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Models\Setting;
use Fleetbase\Support\Auth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    public function __construct(protected PortalConfigService $portalConfig)
    {
    }

    public function getSettings()
    {
        $company = Auth::getCompany();

        try {
            $customerPortalConfig = Setting::lookupFromCompany('customer-portal-config', []);
            $accessUrlSlug        = data_get($customerPortalConfig, 'accessUrlSlug');
            if (!$accessUrlSlug) {
                $accessUrlSlug        = $this->_createDefaultAccessUrlSlug();
                $customerPortalConfig = data_set($customerPortalConfig, 'accessUrlSlug', $accessUrlSlug);
            }

            $customerPortalConfig = data_set($customerPortalConfig, 'accessUrlSlugValidation', $this->_validateAccessUrlSlug($accessUrlSlug));

            return response()->json($this->portalConfig->adminConfig($customerPortalConfig));
        } catch (\Exception $e) {
            Log::error('Unable to load customer portal config:', [$e]);

            return response()->json(['accessUrlSlug' => $company->slug]);
        }
    }

    public function saveSettings(Request $request)
    {
        $customerPortalConfig = $this->portalConfig->sanitize($request->array('customerPortalConfig'));
        Setting::configureCompany('customer-portal-config', $customerPortalConfig);

        return response()->json($this->portalConfig->adminConfig($customerPortalConfig));
    }

    public function validateAccessUrlSlug(Request $request)
    {
        $accessUrlSlug           = (string) $request->input('accessUrlSlug');
        $accessUrlSlugValidation = $this->_validateAccessUrlSlug($accessUrlSlug);

        return response()->json($accessUrlSlugValidation);
    }

    private function _createDefaultAccessUrlSlug()
    {
        $company = Auth::getCompany();
        if ($company) {
            $accessUrlSlug = Str::slug($company->name);
            $numberPrefix  = 1;
            while ($this->_validateAccessUrlSlug($accessUrlSlug)['valid'] === false) {
                $accessUrlSlug = $accessUrlSlug + '-' + $numberPrefix;
                $numberPrefix++;
            }

            return $accessUrlSlug;
        }

        return '';
    }

    private function _validateAccessUrlSlug(string $accessUrlSlug = '')
    {
        if (empty($accessUrlSlug) || !is_string($accessUrlSlug)) {
            return ['code' => 'invalid', 'valid' => false, 'message' => 'The URL provided is invalid.'];
        }

        // Get the current company from session
        $companyUuid = session('company');

        // Pull all access slug urls from settings
        $customerPortalConfigs = Setting::where('key', 'LIKE', '%customer-portal-config')->where('key', 'NOT LIKE', "%{$companyUuid}%")->get();
        $slugs                 = [];
        foreach ($customerPortalConfigs as $customerPortalConfig) {
            $value              = is_string($customerPortalConfig->value) ? json_decode($customerPortalConfig->value) : $customerPortalConfig->value;
            $otherAccessUrlSlug = data_get($value, 'accessUrlSlug');
            if (is_string($otherAccessUrlSlug) && !empty($otherAccessUrlSlug)) {
                $slugs[] = $otherAccessUrlSlug;
            }
        }

        // Check if slug is already taken
        if (in_array($accessUrlSlug, $slugs)) {
            return ['code' => 'already_taken', 'valid' => false, 'message' => 'This URL has already been taken.'];
        }

        return ['code' => 'valid', 'valid' => true];
    }
}
