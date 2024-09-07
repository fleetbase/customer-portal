import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';
import services from '@fleetbase/ember-core/exports/services';

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
        universe.createRegistries(['customer-portal:sidebar']);

        // register menu item in header
        universe.registerMenuItem('auth:login', 'Customer Portal', {
            route: 'customer-portal.login',
            type: 'link',
            wrapperClass: 'btn-block py-1 border dark:border-gray-700 border-gray-200 hover:opacity-50',
            onClick: () => {
                const router = app.lookup('service:router');
                if (router) {
                    router.transitionTo('customer-portal.portal-auth.login');
                }
            },
        });
    };
}

loadInitializers(CustomerPortalEngine, modulePrefix);
