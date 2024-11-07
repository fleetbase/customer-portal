<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Models\Setting;
use Fleetbase\Support\Auth;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    public function getSettings()
    {
        $customerPortalConfig = Setting::lookupFromCompany('customer-portal-config');
        $accessUrlSlug        = data_get($customerPortalConfig, 'accessUrlSlug');
        if (!$accessUrlSlug) {
            $accessUrlSlug        = $this->_createDefaultAccessUrlSlug();
            $customerPortalConfig = data_set($customerPortalConfig, 'accessUrlSlug', $accessUrlSlug);
        }

        $customerPortalConfig = data_set($customerPortalConfig, 'accessUrlSlugValidation', $this->_validateAccessUrlSlug($accessUrlSlug));

        return response()->json($customerPortalConfig);
    }

    public function saveSettings(Request $request)
    {
        $customerPortalConfig = $request->array('customerPortalConfig');
        Setting::configureCompany('customer-portal-config', $customerPortalConfig);

        return response()->json($customerPortalConfig);
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
            $accessUrlSlug = data_get($customerPortalConfig, 'value.accessUrlSlug');
            if (is_string($accessUrlSlug) && !empty($accessUrlSlug)) {
                $slugs[] = $accessUrlSlug;
            }
        }

        // Check if slug is already taken
        if (in_array($accessUrlSlug, $slugs)) {
            return ['code' => 'already_taken', 'valid' => false, 'message' => 'This URL has already been taken.'];
        }

        return ['code' => 'valid', 'valid' => true];
    }
}
