<?php

namespace Fleetbase\CustomerPortal\Providers;

use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\FleetOps\Providers\FleetOpsServiceProvider;
use Fleetbase\Ledger\Providers\LedgerServiceProvider;
use Fleetbase\Models\Comment;
use Fleetbase\Providers\CoreServiceProvider;

if (!class_exists(CoreServiceProvider::class)) {
    throw new \Exception('Customer Portal cannot be loaded without `fleetbase/core-api` installed!');
}

if (!class_exists(FleetOpsServiceProvider::class)) {
    throw new \Exception('Customer Portal cannot be loaded without `fleetbase/fleetops-api` installed!');
}

if (!class_exists(LedgerServiceProvider::class)) {
    throw new \Exception('Customer Portal cannot be loaded without `fleetbase/ledger-api` installed!');
}

/**
 * Starter extension service provider.
 */
class CustomerPortalServiceProvider extends CoreServiceProvider
{
    /**
     * The observers registered with the service provider.
     *
     * @var array
     */
    public $observers = [
        Comment::class => \Fleetbase\CustomerPortal\Observers\CommentObserver::class,
        Issue::class   => \Fleetbase\CustomerPortal\Observers\IssueObserver::class,
    ];

    /**
     * Register any application services.
     *
     * Within the register method, you should only bind things into the
     * service container. You should never attempt to register any event
     * listeners, routes, or any other piece of functionality within the
     * register method.
     *
     * More information on this can be found in the Laravel documentation:
     * https://laravel.com/docs/8.x/providers
     *
     * @return void
     */
    public function register()
    {
        $this->app->register(CoreServiceProvider::class);
    }

    /**
     * Bootstrap any package services.
     *
     * @return void
     *
     * @throws \Exception if the `fleetbase/core-api` package is not installed
     */
    public function boot()
    {
        $this->registerObservers();
        $this->registerExpansionsFrom(__DIR__ . '/../Expansions');
        $this->loadRoutesFrom(__DIR__ . '/../routes.php');
        $this->loadMigrationsFrom(__DIR__ . '/../../migrations');
    }
}
