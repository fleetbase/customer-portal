<?php

require_once __DIR__ . '/Support/FoundationStubs.php';

use Fleetbase\CustomerPortal\Http\Controllers\Internal\v1\AuthController;
use Fleetbase\CustomerPortal\Http\Controllers\Internal\v1\TwoFaController;
use Fleetbase\Http\Requests\LoginRequest;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;

if (!function_exists('Fleetbase\Traits\config')) {
    eval('namespace Fleetbase\Traits; function config($key = null, $default = null) { return $key === "api.cache.enabled" ? false : $default; } function app($abstract = null) { return is_string($abstract) ? (new \\ReflectionClass($abstract))->newInstanceWithoutConstructor() : null; }');
}

if (!function_exists('Fleetbase\Models\config')) {
    eval('namespace Fleetbase\Models; function config($key = null, $default = null) { return $key === "fleetbase.connection.db" ? "mysql" : $default; }');
}

// Released core-api builds the 2FA session TTL with now().
if (!function_exists('Fleetbase\Support\now')) {
    eval('namespace Fleetbase\Support; function now() { return \\Illuminate\\Support\\Carbon::now(); }');
}

if (!class_exists('PortalTwoFactorTestResponse')) {
    class PortalTwoFactorTestResponse
    {
        public function __construct(public array $payload = [], public int $status = 200)
        {
        }
    }

    class PortalTwoFactorTestResponseFactory
    {
        public function json(array $payload = [], int $status = 200): PortalTwoFactorTestResponse
        {
            return new PortalTwoFactorTestResponse($payload, $status);
        }

        public function error($error, int $status = 400, ?array $data = []): PortalTwoFactorTestResponse
        {
            return new PortalTwoFactorTestResponse(array_merge(['errors' => [$error]], $data ?? []), $status);
        }
    }
}

if (!function_exists('Fleetbase\CustomerPortal\Http\Controllers\Internal\v1\response')) {
    eval('namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1; function response() { return new \PortalTwoFactorTestResponseFactory(); }');
}

class PortalTwoFactorTestHashFake
{
    public function check(mixed $value, ?string $hashedValue, array $options = []): bool
    {
        return password_verify((string) $value, (string) $hashedValue);
    }
}

class PortalTwoFactorTestRedisFake
{
    public array $sets = [];

    public function set(string $key, mixed $value, mixed ...$options): bool
    {
        $this->sets[] = $key;

        return true;
    }
}

const PORTAL_2FA_CUSTOMER_UUID = '22222222-2222-4222-8222-222222222222';

function portalTwoFactorBoot(): object
{
    EloquentModel::unsetConnectionResolver();
    EloquentModel::clearBootedModels();

    $container = new Container();
    Container::setInstance($container);
    Facade::setFacadeApplication($container);

    $redis = new PortalTwoFactorTestRedisFake();
    $container->instance('hash', new PortalTwoFactorTestHashFake());
    $container->instance('redis', $redis);
    Facade::clearResolvedInstances();

    $capsule = new Capsule($container);
    $capsule->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''], 'mysql');
    $capsule->setEventDispatcher(new Dispatcher($container));
    $capsule->getDatabaseManager()->setDefaultConnection('mysql');
    $capsule->bootEloquent();
    $container->instance('db', $capsule->getDatabaseManager());

    $db     = $capsule->getConnection('mysql');
    $schema = $db->getSchemaBuilder();
    $schema->create('users', function ($table) {
        $table->string('uuid')->primary();
        $table->string('email')->nullable();
        $table->string('phone')->nullable();
        $table->string('password')->nullable();
        $table->string('type')->nullable();
        $table->timestamp('email_verified_at')->nullable();
        $table->timestamp('deleted_at')->nullable();
        $table->timestamps();
    });
    $schema->create('settings', function ($table) {
        $table->increments('id');
        $table->string('key')->unique();
        $table->text('value')->nullable();
    });

    $db->table('users')->insert([
        'uuid'              => PORTAL_2FA_CUSTOMER_UUID,
        'email'             => 'customer@example.test',
        'password'          => password_hash('correct-password', PASSWORD_BCRYPT),
        'type'              => 'customer',
        'email_verified_at' => '2026-09-01 00:00:00',
    ]);
    $db->table('settings')->insert([
        'key'   => 'user.' . PORTAL_2FA_CUSTOMER_UUID . '.2fa',
        'value' => json_encode(['enabled' => true, 'method' => 'email']),
    ]);

    return (object) ['db' => $db, 'redis' => $redis];
}

function portalLogin(array $input): PortalTwoFactorTestResponse
{
    return (new AuthController())->login(LoginRequest::create('/customer-portal/int/v1/auth/login', 'POST', $input));
}

test('two-fa/check never starts a session or reveals whether an account exists or has two-factor on', function () {
    $env = portalTwoFactorBoot();
    $env->db->table('users')->insert(['uuid' => 'console-user', 'email' => 'admin@example.test', 'type' => 'admin']);

    $check = fn (?string $identity) => (new TwoFaController())->checkTwoFactor(Request::create('/customer-portal/int/v1/two-fa/check', 'GET', ['identity' => $identity]));

    $expected = ['status' => 200, 'payload' => ['twoFaSession' => null, 'isTwoFaEnabled' => false]];

    foreach (['customer@example.test', 'admin@example.test', 'nobody@example.test', null] as $identity) {
        $response = $check($identity);

        expect(['status' => $response->status, 'payload' => $response->payload])->toBe($expected);
    }

    expect($env->redis->sets)->toBe([]);
});

test('login refuses a wrong password before starting a two-factor session', function () {
    $env = portalTwoFactorBoot();

    $response = portalLogin(['identity' => 'customer@example.test', 'password' => 'wrong-password']);

    expect($response->status)->toBe(401)
        ->and($response->payload['code'])->toBe('invalid_credentials')
        ->and($response->payload)->not->toHaveKey('twoFaSession')
        ->and($env->redis->sets)->toBe([]);
});

test('login starts the two-factor session once the password checks out', function () {
    $env = portalTwoFactorBoot();

    $response = portalLogin(['identity' => 'customer@example.test', 'password' => 'correct-password']);

    expect($response->status)->toBe(200)
        ->and($response->payload['isEnabled'])->toBeTrue()
        ->and($response->payload['twoFaSession'])->toBeString()->not->toBeEmpty()
        ->and($response->payload)->not->toHaveKey('token')
        ->and($env->redis->sets)->toHaveCount(1)
        ->and($env->redis->sets[0])->toStartWith('two_fa_session:' . PORTAL_2FA_CUSTOMER_UUID . ':');
});
