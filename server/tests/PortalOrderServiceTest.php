<?php

use Fleetbase\CustomerPortal\Services\PortalOrderService;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Support\Facades\DB;

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

function customerPortalOrderServiceBoot(): SQLiteConnection
{
    $connection = new SQLiteConnection(new PDO('sqlite::memory:'));
    $resolver   = new ConnectionResolver(['default' => $connection, 'mysql' => $connection]);
    $resolver->setDefaultConnection('mysql');
    EloquentModel::setConnectionResolver($resolver);
    $container = Illuminate\Container\Container::getInstance();
    $container->instance('db', new class($connection) {
        public function __construct(public SQLiteConnection $connection)
        {
        }

        public function connection($name = null): SQLiteConnection
        {
            return $this->connection;
        }
    });
    Illuminate\Support\Facades\Facade::setFacadeApplication($container);
    DB::clearResolvedInstance('db');

    $connection->getSchemaBuilder()->create('orders', function ($table) {
        $table->increments('id');
        $table->string('uuid')->unique();
        $table->string('company_uuid');
        $table->string('customer_uuid')->nullable();
        $table->string('customer_type')->nullable();
        $table->string('status')->nullable();
        $table->timestamps();
        $table->softDeletes();
    });

    session(['company' => 'company-1']);

    return $connection;
}

test('dispatcher-created orders are visible by customer uuid regardless of customer type representation', function () {
    $connection = customerPortalOrderServiceBoot();
    $connection->table('orders')->insert([
        [
            'uuid'          => 'portal-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'customer-1',
            'customer_type' => 'fleet-ops:contact',
            'status'        => 'completed',
        ],
        [
            'uuid'          => 'dispatcher-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'customer-1',
            'customer_type' => Fleetbase\FleetOps\Models\Contact::class,
            'status'        => 'completed',
        ],
    ]);

    $context = [
        'contact'  => (object) ['uuid' => 'customer-1'],
        'account'  => (object) ['uuid' => 'customer-1'],
        'accounts' => [['uuid' => 'customer-1', 'customer_type' => 'contact']],
    ];

    $orders = (new PortalOrderService())->queryForAccount($context)->whereIn('status', ['completed', 'done'])->pluck('uuid')->all();

    expect($orders)->toEqualCanonicalizing(['portal-order', 'dispatcher-order']);
});

test('order visibility remains isolated by company and authenticated account uuid', function () {
    $connection = customerPortalOrderServiceBoot();
    $connection->table('orders')->insert([
        [
            'uuid'          => 'visible-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'customer-1',
            'customer_type' => null,
            'status'        => 'completed',
        ],
        [
            'uuid'          => 'other-customer-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'customer-2',
            'customer_type' => 'fleet-ops:contact',
            'status'        => 'completed',
        ],
        [
            'uuid'          => 'other-company-order',
            'company_uuid'  => 'company-2',
            'customer_uuid' => 'customer-1',
            'customer_type' => 'fleet-ops:contact',
            'status'        => 'completed',
        ],
    ]);
    $connection->table('orders')->insert([
        'uuid'          => 'deleted-order',
        'company_uuid'  => 'company-1',
        'customer_uuid' => 'customer-1',
        'customer_type' => 'fleet-ops:contact',
        'status'        => 'completed',
        'deleted_at'    => '2026-08-10 00:00:00',
    ]);

    $context = [
        'contact'  => (object) ['uuid' => 'customer-1'],
        'account'  => (object) ['uuid' => 'customer-1'],
        'accounts' => [],
    ];

    expect((new PortalOrderService())->queryForAccount($context)->pluck('uuid')->all())->toBe(['visible-order']);
});

test('all authorized customer account uuids remain visible', function () {
    $connection = customerPortalOrderServiceBoot();
    $connection->table('orders')->insert([
        [
            'uuid'          => 'contact-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'customer-1',
            'customer_type' => 'legacy-contact-type',
            'status'        => 'created',
        ],
        [
            'uuid'          => 'vendor-order',
            'company_uuid'  => 'company-1',
            'customer_uuid' => 'vendor-1',
            'customer_type' => 'legacy-vendor-type',
            'status'        => 'done',
        ],
    ]);

    $context = [
        'contact'  => (object) ['uuid' => 'customer-1'],
        'account'  => (object) ['uuid' => 'vendor-1'],
        'accounts' => [
            ['uuid' => 'customer-1', 'customer_type' => 'contact'],
            ['uuid' => 'vendor-1', 'customer_type' => 'vendor'],
        ],
    ];

    expect((new PortalOrderService())->queryForAccount($context)->pluck('uuid')->all())->toEqualCanonicalizing(['contact-order', 'vendor-order']);
});
