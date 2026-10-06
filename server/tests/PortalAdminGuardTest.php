<?php

require_once __DIR__ . '/Support/FoundationStubs.php';

use Fleetbase\CustomerPortal\Http\Middleware\PortalAdminGuard;
use Fleetbase\Models\User;
use Illuminate\Http\Request;

if (!class_exists('PortalAdminGuardTestResponse')) {
    class PortalAdminGuardTestResponse
    {
        public function __construct(public array $payload = [], public int $status = 200)
        {
        }
    }

    class PortalAdminGuardTestResponseFactory
    {
        public function error($error, int $status = 400, ?array $data = []): PortalAdminGuardTestResponse
        {
            return new PortalAdminGuardTestResponse(array_merge(['errors' => [$error]], $data ?? []), $status);
        }
    }
}

if (!function_exists('Fleetbase\CustomerPortal\Http\Middleware\response')) {
    eval('namespace Fleetbase\CustomerPortal\Http\Middleware; function response() { return new \PortalAdminGuardTestResponseFactory(); }');
}

function portalAdminGuardUser(?string $type): ?User
{
    if ($type === null) {
        return null;
    }

    $user = (new ReflectionClass(User::class))->newInstanceWithoutConstructor();
    $user->setRawAttributes(['uuid' => 'user-' . $type, 'company_uuid' => 'company-1', 'type' => $type], true);

    return $user;
}

function portalAdminGuardHandle(?User $user, string $method, string $uri, string $action): mixed
{
    $request = Request::create($uri, $method);
    $request->setUserResolver(fn () => $user);

    return (new PortalAdminGuard())->handle($request, fn () => 'next', $action);
}

$portalAdminSettingRoutes = [
    'read config'     => ['GET', '/customer-portal/int/v1/settings/config', 'view'],
    'save config'     => ['POST', '/customer-portal/int/v1/settings/config', 'update'],
    'validate slug'   => ['POST', '/customer-portal/int/v1/settings/validate-access-url', 'update'],
];

test('a portal customer token is refused on the organization settings routes', function (string $method, string $uri, string $action) {
    $response = portalAdminGuardHandle(portalAdminGuardUser('customer'), $method, $uri, $action);

    expect($response)->toBeInstanceOf(PortalAdminGuardTestResponse::class)
        ->and($response->status)->toBe(403)
        ->and($response->payload['code'])->toBe('portal_admin_required');
})->with($portalAdminSettingRoutes);

test('a request without a resolved user is refused on the organization settings routes', function (string $method, string $uri, string $action) {
    $response = portalAdminGuardHandle(portalAdminGuardUser(null), $method, $uri, $action);

    expect($response)->toBeInstanceOf(PortalAdminGuardTestResponse::class)
        ->and($response->status)->toBe(403);
})->with($portalAdminSettingRoutes);

test('an administrator reaches the organization settings routes', function (string $method, string $uri, string $action) {
    expect(portalAdminGuardHandle(portalAdminGuardUser('admin'), $method, $uri, $action))->toBe('next');
})->with($portalAdminSettingRoutes);

test('the organization settings routes are registered behind the admin guard', function () {
    $routes = file_get_contents(__DIR__ . '/../src/routes.php');

    foreach ([
        "get('config', 'SettingController@getSettings')"                   => 'view',
        "post('config', 'SettingController@saveSettings')"                 => 'update',
        "post('validate-access-url', 'SettingController@validateAccessUrlSlug')" => 'update',
    ] as $route => $action) {
        expect($routes)->toContain($route . "->middleware(Fleetbase\\CustomerPortal\\Http\\Middleware\\PortalAdminGuard::class . ':" . $action . "')");
    }
});
