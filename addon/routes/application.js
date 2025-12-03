import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import removeBootLoader from '@fleetbase/console/utils/remove-boot-loader';

export default class ApplicationRoute extends Route {
    @service('universe/hook-service') hookService;
    @service('universe/extension-manager') extensionManager;
    @service store;
    @service theme;
    @service session;
    @service hostRouter;

    queryParams = {
        company: {
            refreshRoute: false,
        },
    };

    @action willTransition(transition) {
        console.log('[CustomerPortal: ApplicationRoute: willTransition]', ...arguments);
        this.hookService.execute('customer-portal:will-transition', this.session, this.hostRouter, transition);
    }

    @action loading(transition) {
        console.log('[CustomerPortal: ApplicationRoute: loading]', ...arguments);
        this.hookService.execute('customer-portal:loading', this.session, this.hostRouter, transition);
    }

    async beforeModel(transition) {
        console.log('[CustomerPortal: ApplicationRoute: beforeModel]', ...arguments);
        console.log('[CustomerPortal: ApplicationRoute: this.extensionManager]', this.extensionManager);
        console.log('[CustomerPortal: ApplicationRoute: this.hookService]', this.hookService);
        await this.extensionManager.waitForBoot();
        console.log('boot completed?')
        this.hookService.execute('customer-portal:before-model', this.session, this.hostRouter, transition);
    }

    /**
     * Get the branding settings.
     *
     * @return {BrandModel}
     * @memberof ApplicationRoute
     */
    model() {
        return this.store.findRecord('brand', 1);
    }

    /**
     * Remove boot loader if not authenticated.
     *
     * @memberof ApplicationRoute
     */
    afterModel() {
        if (!this.session.isAuthenticated) removeBootLoader();
    
    }

    /**
     * Add the fleetbase-portal body class.
     *
     * @memberof ApplicationRoute
     */
    activate() {
        this.theme.setRoutebodyClassNames(['fleetbase-portal']);
    }
}
