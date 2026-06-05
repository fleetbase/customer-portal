<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Http\Resources\v1\OrderConfig as OrderConfigResource;
use Fleetbase\FleetOps\Http\Resources\v1\ServiceRate as ServiceRateResource;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Models\ServiceRate;
use Fleetbase\Models\Setting;
use Fleetbase\Support\Auth;

class PortalConfigService
{
    public function config(): array
    {
        $config = Setting::lookupFromCompany('customer-portal-config', []);

        return is_array($config) ? $config : [];
    }

    public function adminConfig(?array $config = null): array
    {
        $config       = $config ?? $this->config();
        $orderConfigs = OrderConfig::where('company_uuid', session('company'))->get();
        $serviceRates = ServiceRate::with(['orderConfig'])->where('company_uuid', session('company'))->get();

        return [
            ...$config,
            'enabledOrderConfigIds'    => $this->effectiveOrderConfigIds($orderConfigs, $config),
            'enabledServiceRateIds'    => $this->effectiveServiceRateIds($serviceRates, $config),
            'paymentsEnabled'          => $this->paymentsEnabled($config),
            'paymentsOnboardCompleted' => $this->paymentsOnboardCompleted(),
            'orderConfigs'             => OrderConfigResource::collection($orderConfigs)->resolve(),
            'serviceRates'             => ServiceRateResource::collection($serviceRates)->resolve(),
        ];
    }

    public function enabledOrderConfigIds(?array $config = null): ?array
    {
        $config = $config ?? $this->config();
        if (array_key_exists('enabledOrderConfigIds', $config)) {
            return $this->normalizeIds($config['enabledOrderConfigIds']);
        }

        $legacyIds = Setting::lookupFromCompany('fleet-ops.customer-enabled-order-configs');
        if (is_array($legacyIds) && count($legacyIds) > 0) {
            return $this->normalizeIds($legacyIds);
        }

        return null;
    }

    public function enabledServiceRateIds(?array $config = null): ?array
    {
        $config = $config ?? $this->config();
        if (array_key_exists('enabledServiceRateIds', $config)) {
            return $this->normalizeIds($config['enabledServiceRateIds']);
        }

        return null;
    }

    public function paymentsEnabled(?array $config = null): bool
    {
        $config = $config ?? $this->config();
        if (array_key_exists('paymentsEnabled', $config)) {
            return (bool) $config['paymentsEnabled'];
        }

        $legacyConfig = Setting::lookupFromCompany('fleet-ops.customer-payments-configs', []);

        return (bool) data_get($legacyConfig, 'paymentsEnabled', false);
    }

    public function paymentsConfig(?array $config = null): array
    {
        return [
            'paymentsEnabled'          => $this->paymentsEnabled($config),
            'paymentGateway'           => 'stripe',
            'paymentsOnboardCompleted' => $this->paymentsOnboardCompleted(),
        ];
    }

    public function sanitize(array $config): array
    {
        foreach (['enabledOrderConfigIds', 'enabledServiceRateIds'] as $key) {
            if (array_key_exists($key, $config)) {
                $config[$key] = $this->normalizeIds($config[$key]);
            }
        }

        if (array_key_exists('paymentsEnabled', $config)) {
            $config['paymentsEnabled'] = (bool) $config['paymentsEnabled'];
        }

        return $config;
    }

    protected function effectiveOrderConfigIds($orderConfigs, array $config): array
    {
        $configuredIds = $this->enabledOrderConfigIds($config);
        if (is_array($configuredIds)) {
            return $configuredIds;
        }

        return $orderConfigs->map(fn ($orderConfig) => $orderConfig->uuid)->values()->all();
    }

    protected function effectiveServiceRateIds($serviceRates, array $config): array
    {
        $configuredIds = $this->enabledServiceRateIds($config);
        if (is_array($configuredIds)) {
            return $configuredIds;
        }

        return $serviceRates->map(fn ($serviceRate) => $serviceRate->uuid)->values()->all();
    }

    protected function paymentsOnboardCompleted(): bool
    {
        $company = Auth::getCompany();

        return $company && isset($company->stripe_connect_id);
    }

    protected function normalizeIds($ids): array
    {
        if (!is_array($ids)) {
            return [];
        }

        return array_values(array_filter(array_unique(array_map(function ($id) {
            return is_scalar($id) ? (string) $id : null;
        }, $ids)), fn ($id) => filled($id)));
    }
}
