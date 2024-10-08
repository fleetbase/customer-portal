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
    preboot = function (app, engine, universe) {
        // register hook to catch urls and load customer portal
        universe.registerHook('application:loading', (session, router, transition) => {
            if (universe.initialLocation) {
                const exiting = transition && transition.from && typeof transition.from.name === 'string' && transition.from.name.startsWith('customer-portal');
                const pathname = universe.initialLocation.pathname;
                const validPathname = typeof pathname === 'string' && pathname.startsWith('/customer-access/') && pathname.split('/').filter(Boolean).length === 2;
                if (validPathname && !exiting) {
                    router.transitionTo('customer-portal', { queryParams: { company: pathname.replace('/customer-access/', '') } });
                }
            }
        });
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

        // register admin settings to the organization settings
        // @todo add permissions
        universe.registerSettingsMenuItem('Customer Portal', {
            icon: 'users-gear',
            slug: 'customer-portal',
            index: 3,
            view: 'index',
            component: CustomerPortalAdminSettingsComponent,
            onClick: (menuItem) => {
                const router = app.lookup('service:router');
                if (router) {
                    return router.transitionTo('console.settings.virtual', menuItem.slug);
                }
            },
        });

        // register hook to redirect customers to portal
        universe.registerHook('console:before-model', (session, router) => {
            if (session.data.authenticated.type === 'customer') {
                return router.transitionTo('customer-portal');
            }
        });
    };
}

loadInitializers(CustomerPortalEngine, modulePrefix);
