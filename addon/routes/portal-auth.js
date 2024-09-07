import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalAuthRoute extends Route {
    @service session;

    /**
     * If user is authentication redirect to portal.
     *
     * @memberof LoginRoute
     * @void
     */
    beforeModel() {
        this.session.prohibitAuthentication('customer-portal.portal');
    }
}
