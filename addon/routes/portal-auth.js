import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalAuthRoute extends Route {
    @service session;
    @service hostRouter;
    @service universe;

    /**
     * If user is authentication redirect to portal.
     *
     * @memberof LoginRoute
     * @void
     */
    beforeModel(transition) {
        this.session.prohibitAuthentication('customer-portal.portal');
        this.universe.callHooks('customer-portal:auth:before-model', this.session, this.hostRouter, transition);
    }
}
