import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalAuthRoute extends Route {
    @service('universe/hook-service') hookService;
    @service session;
    @service hostRouter;

    /**
     * If user is authentication redirect to portal.
     *
     * @memberof LoginRoute
     * @void
     */
    beforeModel(transition) {
        this.session.prohibitAuthentication('customer-portal.portal');
        this.hookService.execute('customer-portal:auth:before-model', this.session, this.hostRouter, transition);
    }
}
