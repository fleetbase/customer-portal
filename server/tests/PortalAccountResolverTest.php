<?php

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
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

// abort_if() ships with laravel/framework, which this package does not install.
if (!function_exists('abort_if')) {
    function abort_if($boolean, $code, $message = '')
    {
        if ($boolean) {
            throw new RuntimeException($message, $code);
        }
    }
}

function customerPortalAccountResolverBoot(): SQLiteConnection
{
    $connection = new SQLiteConnection(new PDO('sqlite::memory:'));
    $resolver   = new ConnectionResolver(['default' => $connection, 'mysql' => $connection]);
    $resolver->setDefaultConnection('mysql');
    EloquentModel::setConnectionResolver($resolver);

    $schema = $connection->getSchemaBuilder();
    $schema->create('contacts', function ($table) {
        $table->increments('id');
        $table->string('uuid')->unique();
        $table->string('public_id')->nullable();
        $table->string('company_uuid');
        $table->string('user_uuid')->nullable();
        $table->string('type')->nullable();
        $table->string('name')->nullable();
        $table->timestamps();
        $table->softDeletes();
    });
    $schema->create('vendors', function ($table) {
        $table->increments('id');
        $table->string('uuid')->unique();
        $table->string('public_id')->nullable();
        $table->string('company_uuid');
        $table->string('name')->nullable();
        $table->timestamps();
        $table->softDeletes();
    });
    $schema->create('vendor_personnels', function ($table) {
        $table->increments('id');
        $table->string('uuid')->nullable();
        $table->string('vendor_uuid');
        $table->string('contact_uuid');
        $table->string('status')->nullable();
        $table->timestamps();
        $table->softDeletes();
    });

    // One user holding a customer profile in two companies, signed in to company-1.
    $connection->table('contacts')->insert([
        ['uuid' => 'contact-1', 'public_id' => 'contact_1', 'company_uuid' => 'company-1', 'user_uuid' => 'user-1', 'type' => 'customer', 'name' => 'Pat Customer'],
        ['uuid' => 'contact-2', 'public_id' => 'contact_2', 'company_uuid' => 'company-2', 'user_uuid' => 'user-1', 'type' => 'customer', 'name' => 'Pat Customer'],
    ]);
    $connection->table('vendors')->insert([
        ['uuid' => 'vendor-1', 'public_id' => 'vendor_1', 'company_uuid' => 'company-1', 'name' => 'Own Company Account'],
        ['uuid' => 'vendor-2', 'public_id' => 'vendor_2', 'company_uuid' => 'company-2', 'name' => 'Other Tenant Account'],
    ]);

    session(['company' => 'company-1', 'user' => 'user-1']);

    return $connection;
}

test('portal accounts only come from the session company', function () {
    $connection = customerPortalAccountResolverBoot();
    $connection->table('vendor_personnels')->insert([
        ['vendor_uuid' => 'vendor-1', 'contact_uuid' => 'contact-1', 'status' => 'active'],
        ['vendor_uuid' => 'vendor-2', 'contact_uuid' => 'contact-2', 'status' => 'active'],
    ]);

    $context = (new PortalAccountResolver())->resolve();

    expect($context['contact']->uuid)->toBe('contact-1')
        ->and($context['account']->uuid)->toBe('vendor-1')
        ->and($context['account_type'])->toBe('vendor')
        ->and(collect($context['accounts'])->pluck('uuid')->all())->toBe(['contact-1', 'vendor-1']);
});

test('a vendor account from another company is never selected as the portal account', function () {
    $connection = customerPortalAccountResolverBoot();
    $connection->table('vendor_personnels')->insert([
        ['vendor_uuid' => 'vendor-2', 'contact_uuid' => 'contact-2', 'status' => 'active'],
    ]);

    $context = (new PortalAccountResolver())->resolve();

    expect($context['account']->uuid)->toBe('contact-1')
        ->and($context['account_type'])->toBe('contact')
        ->and(collect($context['accounts'])->pluck('uuid')->all())->toBe(['contact-1']);
});

test('a contact from the session company cannot be linked into another company\'s vendor', function () {
    $connection = customerPortalAccountResolverBoot();
    // Malformed link across tenants: the session company's contact on company-2's vendor.
    $connection->table('vendor_personnels')->insert([
        ['vendor_uuid' => 'vendor-2', 'contact_uuid' => 'contact-1', 'status' => 'active'],
    ]);

    $context = (new PortalAccountResolver())->resolve();

    expect(collect($context['accounts'])->pluck('uuid')->all())->toBe(['contact-1']);
});
