import { MenuItem, ExtensionComponent, Hook } from '@fleetbase/ember-core/contracts';

export default {
    setupExtension(app, universe) {
        const hookService = universe.getService('hook');
        const menuService = universe.getService('menu');
        const widgetService = universe.getService('widget');
        const registryService = universe.getService('registry');

        // Register hook to catch urls and load customer portal
        hookService.registerHook(
            new Hook('application:before-model', (session, router, transition) => {
                if (universe.initialLocation) {
                    const exiting = transition && transition.from && typeof transition.from.name === 'string' && transition.from.name.startsWith('customer-portal');
                    const pathname = universe.initialLocation.pathname;
                    const validPathname = typeof pathname === 'string' && pathname.startsWith('/customer-access/') && pathname.split('/').filter(Boolean).length === 2;
                    if (validPathname && !exiting) {
                        router.transitionTo('customer-portal', { queryParams: { company: pathname.replace('/customer-access/', '') } });
                    }
                }
            })
        );

        // Register hook to redirect customers to portal
        hookService.registerHook(
            new Hook('console:before-model', (session, router) => {
                if (session.data.authenticated.type === 'customer') {
                    return router.transitionTo('customer-portal');
                }
            })
        );

        // Create registries
        registryService.createRegistries(['customer-portal:sidebar', 'customer-portal:auth:login']);

        // Register the customer portal dashboard
        widgetService.registerDashboard('customer-portal');

        // register a customer portal login button on login page
        menuService.registerMenuItem(
            'auth:login',
            new MenuItem({
                title: 'Customer Portal',
                route: 'customer-portal.login',
                icon: 'person',
                type: 'link',
                wrapperClass: 'btn-block py-1 border dark:border-gray-700 border-gray-200 hover:opacity-50',
                onClick: async () => {
                    const router = app.lookup('service:router');
                    if (router) {
                        router.transitionTo('customer-portal.portal-auth.login');
                    }
                },
            })
        );

        // Register organization level admin settings to the settings
        menuService.registerSettingsMenuItem(
            new MenuItem({
                title: 'Customer Portal',
                icon: 'users-gear',
                slug: 'customer-portal',
                index: 3,
                view: 'index',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'customer-portal-admin-settings'),
                onClick: (menuItem) => {
                    const router = app.lookup('service:router');
                    if (router) {
                        return router.transitionTo('console.settings.virtual', menuItem.slug);
                    }
                },
            })
        );
    },
};
