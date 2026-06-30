import { MenuItem, ExtensionComponent, Hook, Widget } from '@fleetbase/ember-core/contracts';

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
                    return router.transitionTo(session.isAuthenticated ? 'customer-portal.portal' : 'customer-portal.portal-auth.login');
                }
            })
        );

        // Create registries
        registryService.createRegistries(['customer-portal:sidebar', 'customer-portal:auth:login']);

        // Register the customer portal dashboard
        this.registerWidgets(widgetService);

        // register a customer portal login button on login page
        menuService.registerMenuItem(
            'auth:login',
            new MenuItem({
                title: 'Customer Portal',
                route: 'customer-portal.portal-auth.login',
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

    registerWidgets(widgetService) {
        const widgets = [
            new Widget({
                id: 'customer-portal-active-orders',
                name: 'Active Orders',
                description: 'Customer-visible orders that are not yet completed or canceled.',
                icon: 'boxes-packing',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/active-orders'),
                grid_options: { x: 0, y: 0, w: 3, h: 3, minW: 3, minH: 3 },
                category: 'Operations',
                default: true,
            }),
            new Widget({
                id: 'customer-portal-completed-orders',
                name: 'Completed Orders',
                description: 'Orders completed for the active portal customer account.',
                icon: 'circle-check',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/completed-orders'),
                grid_options: { x: 3, y: 0, w: 3, h: 3, minW: 3, minH: 3 },
                category: 'Operations',
                default: true,
            }),
            new Widget({
                id: 'customer-portal-unpaid-invoices',
                name: 'Unpaid Invoices',
                description: 'Outstanding customer invoices when Ledger is installed.',
                icon: 'file-invoice-dollar',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/unpaid-invoices'),
                grid_options: { x: 6, y: 0, w: 3, h: 3, minW: 3, minH: 3 },
                category: 'Billing',
                default: true,
            }),
            new Widget({
                id: 'customer-portal-open-tickets',
                name: 'Open Support Tickets',
                description: 'Open customer support issues backed by FleetOps Issues.',
                icon: 'headset',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/open-tickets'),
                grid_options: { x: 9, y: 0, w: 3, h: 3, minW: 3, minH: 3 },
                category: 'Support',
                default: true,
            }),
            new Widget({
                id: 'customer-portal-recent-orders',
                name: 'Recent Orders',
                description: 'Most recent orders for the active portal customer account.',
                icon: 'clock-rotate-left',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/recent-orders'),
                grid_options: { x: 0, y: 3, w: 6, h: 14, minW: 5, minH: 10 },
                category: 'Operations',
                default: true,
            }),
            new Widget({
                id: 'customer-portal-pending-actions',
                name: 'Pending Actions',
                description: 'Invoices, tickets, and orders that need customer attention.',
                icon: 'bell',
                component: new ExtensionComponent('@fleetbase/customer-portal-engine', 'widget/pending-actions'),
                grid_options: { x: 6, y: 3, w: 6, h: 14, minW: 5, minH: 10 },
                category: 'Overview',
                default: true,
            }),
        ];

        widgetService.registerDashboard('customer-portal');
        widgetService.registerDashboard('customer-portal-overview');
        widgetService.registerDashboard('customer-portal-overview-v2');
        widgetService.registerWidgets('customer-portal', widgets);
        widgetService.registerWidgets('customer-portal-overview', widgets);
        widgetService.registerWidgets('customer-portal-overview-v2', widgets);
    },
};
