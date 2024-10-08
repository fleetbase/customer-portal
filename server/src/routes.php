<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::prefix(config('customer-portal.api.routing.prefix', 'customer-portal'))->namespace('Fleetbase\CustomerPortal\Http\Controllers')->group(
    function ($router) {
        /*
        |--------------------------------------------------------------------------
        | Customer Portal API Routes
        |--------------------------------------------------------------------------
        |
        | Primary internal routes for console.
        */
        $router->prefix(config('customer-portal.api.routing.internal_prefix', 'int'))->namespace('Internal')->group(
            function ($router) {
                $router->group(
                    ['prefix' => 'v1', 'namespace' => 'v1', 'middleware' => ['fleetbase.protected']],
                    function ($router) {
                        $router->group(
                            ['prefix' => 'settings', 'middleware' => [Spatie\ResponseCache\Middlewares\DoNotCacheResponse::class]],
                            function ($router) {
                                $router->get('config', 'SettingController@getSettings');
                                $router->post('config', 'SettingController@saveSettings');
                                $router->post('validate-access-url', 'SettingController@validateAccessUrlSlug');
                            }
                        );
                        // $router->fleetbaseRoutes('resource');
                    }
                );
            }
        );
    }
);
