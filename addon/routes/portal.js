import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import '@fleetbase/leaflet-routing-machine';

export default class PortalRoute extends Route {
    @service universe;
    @service session;
    @service customerSession;
    @service hostRouter;

    @action loading(transition) {
        this.universe.callHooks('customer-portal:portal:loading', this.session, this.hostRouter, transition);
    }

    /**
     * Require authentication to access all `portal` routes.
     *
     * @param {Transition} transition
     * @return {Promise}
     * @memberof PortalRoute
     */
    async beforeModel(transition) {
        this.session.requireAuthentication(transition, 'customer-portal.portal-auth.login');
        this.universe.callHooks('customer-portal:portal:before-model', this.session, this.hostRouter, transition);

        if (this.session.isAuthenticated) {
            await this.universe.booting();
            await this.session.promiseCurrentUser(transition);
            return this.customerSession.promiseCurrentCustomer();
        }
    }
}
