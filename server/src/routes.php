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
                    ['prefix' => 'v1', 'namespace' => 'v1'],
                    function ($router) {
                        $router->group(
                            ['prefix' => 'auth', 'middleware' => [Fleetbase\Http\Middleware\ThrottleRequests::class]],
                            function ($router) {
                                $router->post('login', 'AuthController@login');
                            }
                        );
                        $router->group(
                            ['prefix' => 'two-fa', 'middleware' => [Fleetbase\Http\Middleware\ThrottleRequests::class]],
                            function ($router) {
                                $router->get('check', 'TwoFaController@checkTwoFactor');
                                $router->post('validate', 'TwoFaController@validateSession');
                                $router->post('verify', 'TwoFaController@verifyCode');
                                $router->post('resend', 'TwoFaController@resendCode');
                                $router->post('invalidate', 'TwoFaController@invalidateSession');
                            }
                        );
                        $router->group(
                            ['middleware' => ['fleetbase.protected']],
                            function ($router) {
                                $router->group(
                                    ['prefix' => 'settings', 'middleware' => []],
                                    function ($router) {
                                        $router->get('config', 'SettingController@getSettings');
                                        $router->post('config', 'SettingController@saveSettings');
                                        $router->post('validate-access-url', 'SettingController@validateAccessUrlSlug');
                                    }
                                );
                                $router->get('account', 'AccountController@account');
                                $router->post('account/change-password', 'AccountController@changePassword');
                                $router->post('account/convert-to-vendor', 'CustomerConversionController@convertCurrentContactToVendor');
                                $router->get('account/personnels', 'AccountPersonnelController@index');
                                $router->get('account/personnel-candidates', 'AccountPersonnelController@candidates');
                                $router->post('account/personnels', 'AccountPersonnelController@store');
                                $router->delete('account/personnels/{contact}', 'AccountPersonnelController@destroy');
                                $router->get('order-configs', 'OrderController@orderConfigs');
                                $router->post('service-quotes/preliminary', 'ServiceQuoteController@preliminary');
                                $router->post('service-quotes/stripe-checkout-session', 'ServiceQuoteController@createStripeCheckoutSession');
                                $router->get('service-quotes/stripe-checkout-session', 'ServiceQuoteController@getStripeCheckoutSessionStatus');
                                $router->get('payments/config', 'PaymentController@config');
                                $router->get('places/search', 'PlaceController@search');
                                $router->get('places/lookup', 'PlaceController@lookup');
                                $router->post('places', 'PlaceController@create');
                                $router->patch('places/{id}', 'PlaceController@update');
                                $router->delete('places/{id}', 'PlaceController@delete');
                                $router->get('orders', 'OrderController@orders');
                                $router->post('orders', 'OrderController@createOrder');
                                $router->get('orders/summary', 'OrderController@orderSummary');
                                $router->get('orders/{id}', 'OrderController@order');
                                $router->post('orders/{id}/cancel', 'OrderController@cancelOrder');
                                $router->post('orders/{id}/reschedule', 'OrderController@rescheduleOrder');
                                $router->post('orders/{id}/files', 'OrderController@attachFiles');
                                $router->delete('orders/{id}/files/{file}', 'OrderController@deleteFile');
                                $router->get('issues', 'SupportController@issues');
                                $router->post('issues', 'SupportController@createIssue');
                                $router->get('issues/summary', 'SupportController@summary');
                                $router->get('issues/{id}/comments', 'SupportController@comments');
                                $router->post('issues/{id}/comments', 'SupportController@createComment');
                                $router->post('issues/{id}/comments/{comment}/replies', 'SupportController@createReply');
                                $router->patch('issues/{id}/comments/{comment}', 'SupportController@updateComment');
                                $router->delete('issues/{id}/comments/{comment}', 'SupportController@deleteComment');
                                $router->get('issues/{id}', 'SupportController@issue');
                                $router->get('documents', 'DocumentController@documents');
                                $router->get('address-book', 'AddressBookController@addressBook');
                                $router->get('notification-preferences', 'NotificationPreferenceController@preferences');
                                $router->post('notification-preferences', 'NotificationPreferenceController@savePreferences');
                                $router->get('pending-actions', 'DashboardController@pendingActions');
                                $router->post('contacts/{contact}/convert-to-vendor', 'CustomerConversionController@convertContactToVendor');
                                $router->get('invoices', 'BillingController@invoices');
                                $router->get('invoices/summary', 'BillingController@summary');
                                $router->get('invoices/{id}', 'BillingController@invoice');
                            }
                        );
                    }
                );
            }
        );
    }
);
