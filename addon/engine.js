import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';
import services from '@fleetbase/ember-core/exports/services';
import CustomerPortalAdminSettingsComponent from './components/customer-portal-admin-settings';

const { modulePrefix } = config;
const externalRoutes = ['console', 'extensions'];

export default class CustomerPortalEngine extends Engine {
    modulePrefix = modulePrefix;
    Resolver = Resolver;
    dependencies = {
        services,
        externalRoutes,
    };
    setupExtension = function (app, engine, universe) {
        // create registries
        universe.createRegistries(['customer-portal:sidebar', 'customer-portal:auth:login']);

        // register a customer dashboard
        universe.registerDashboard('customer-portal');

        // register a customer portal login button on login page
        universe.registerMenuItem('auth:login', 'Customer Portal', {
            route: 'customer-portal.login',
            icon: 'person',
            type: 'link',
            wrapperClass: 'btn-block py-1 border dark:border-gray-700 border-gray-200 hover:opacity-50',
            onClick: () => {
                const router = app.lookup('service:router');
                if (router) {
                    router.transitionTo('customer-portal.portal-auth.login');
                }
            },
        });

        // register customer portal link at login page
        universe.afterBoot(function (universe) {
            if (universe.didBootEngine('@fleetbase/fleetops-engine')) {
                universe.registerMenuItem('engine:fleet-ops', 'Customer Portal', {
                    component: CustomerPortalAdminSettingsComponent,
                    registerComponentToEngine: '@fleetbase/fleetops-engine',
                    icon: 'users-gear',
                    slug: 'customer-portal',
                    section: 'settings',
                });
            }
        });

        // // register admin settings -- create a fleet-ops menu panel with it's own setting options
        // universe.registerAdminMenuItem('Customer Portal', {
        //     icon: 'users-gear',
        //     component: CustomerPortalAdminSettingsComponent,
        //     slug: 'customer-portal',
        // });

        // register hook to redirect customers to portal
        universe.registerHook('console:before-model', (session, router) => {
            if (session.data.authenticated.type === 'customer') {
                return router.transitionTo('customer-portal');
            }
        });
    };
}

loadInitializers(CustomerPortalEngine, modulePrefix);
