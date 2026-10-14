<?php

require_once __DIR__ . '/Support/FoundationStubs.php';

use Fleetbase\CustomerPortal\Http\Controllers\Internal\v1\SettingController;
use Fleetbase\CustomerPortal\Services\PortalConfigService;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\SQLiteConnection;

if (!function_exists('Fleetbase\Traits\config')) {
    eval('namespace Fleetbase\Traits; function config($key = null, $default = null) { return $key === "api.cache.enabled" ? false : $default; } function app($abstract = null) { return is_string($abstract) ? (new \ReflectionClass($abstract))->newInstanceWithoutConstructor() : null; }');
}

if (!function_exists('Fleetbase\Models\config')) {
    eval('namespace Fleetbase\Models; function config($key = null, $default = null) { return $key === "fleetbase.connection.db" ? "mysql" : $default; }');
}

if (!function_exists('session')) {
    function session($key = null, $default = null)
    {
        static $values = [];

        if (is_array($key)) {
            $values = array_merge($values, $key);

            return null;
        }

        return $key === null ? $values : ($values[$key] ?? $default);
    }
}

function customerPortalSettingSlugBoot(): SQLiteConnection
{
    $connection = new SQLiteConnection(new PDO('sqlite::memory:'));
    $resolver   = new ConnectionResolver(['default' => $connection, 'mysql' => $connection]);
    $resolver->setDefaultConnection('mysql');
    EloquentModel::setConnectionResolver($resolver);

    $connection->getSchemaBuilder()->create('settings', function ($blueprint) {
        $blueprint->increments('id');
        $blueprint->string('key')->nullable();
        $blueprint->text('value')->nullable();
        $blueprint->timestamps();
    });

    session(['company' => 'company-a']);

    return $connection;
}

function customerPortalUniqueAccessUrlSlug(string $baseSlug): string
{
    $method = new ReflectionMethod(SettingController::class, '_uniqueAccessUrlSlug');
    $method->setAccessible(true);

    return $method->invoke(new SettingController(new PortalConfigService()), $baseSlug);
}

function customerPortalSlugConfig(string $companyUuid, string $accessUrlSlug): array
{
    return ['key' => 'company.' . $companyUuid . '.customer-portal-config', 'value' => json_encode(['accessUrlSlug' => $accessUrlSlug])];
}

test('the default access url slug is the company slug when no other company holds it', function () {
    customerPortalSettingSlugBoot();

    expect(customerPortalUniqueAccessUrlSlug('acme-logistics'))->toBe('acme-logistics');
});

test('the default access url slug gets a numeric suffix when other companies hold it', function () {
    $connection = customerPortalSettingSlugBoot();
    $connection->table('settings')->insert([
        customerPortalSlugConfig('company-b', 'acme-logistics'),
        customerPortalSlugConfig('company-c', 'acme-logistics-1'),
    ]);

    // Each candidate is the base slug plus a suffix, not the previous candidate plus a suffix.
    expect(customerPortalUniqueAccessUrlSlug('acme-logistics'))->toBe('acme-logistics-2');
});

test('the company\'s own access url slug does not count as a collision', function () {
    $connection = customerPortalSettingSlugBoot();
    $connection->table('settings')->insert([
        customerPortalSlugConfig('company-a', 'acme-logistics'),
    ]);

    expect(customerPortalUniqueAccessUrlSlug('acme-logistics'))->toBe('acme-logistics');
});
