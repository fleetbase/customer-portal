import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalRoute extends Route {
    @service session;
    @service universe;

    /**
     * Require authentication to access all `portal` routes.
     *
     * @param {Transition} transition
     * @return {Promise}
     * @memberof PortalRoute
     */
    async beforeModel(transition) {
        this.session.requireAuthentication(transition, 'customer-portal.portal-auth.login');

        if (this.session.isAuthenticated) {
            await this.universe.booting();
            return this.session.promiseCurrentUser(transition);
        }
    }
}
