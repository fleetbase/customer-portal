import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import removeBootLoader from '@fleetbase/console/utils/remove-boot-loader';

export default class ApplicationRoute extends Route {
    @service store;
    @service theme;
    @service session;
    @service universe;
    @service hostRouter;

    queryParams = {
        company: {
            refreshRoute: false,
        },
    };

    @action willTransition(transition) {
        this.universe.callHooks('customer-portal:will-transition', this.session, this.hostRouter, transition);
    }

    @action loading(transition) {
        this.universe.callHooks('customer-portal:loading', this.session, this.hostRouter, transition);
    }

    async beforeModel(transition) {
        await this.universe.booting();
        this.universe.callHooks('customer-portal:before-model', this.session, this.hostRouter, transition);
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
        if (!this.session.isAuthenticated) {
            removeBootLoader();
        }
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
