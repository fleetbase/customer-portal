import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import removeBootLoader from '@fleetbase/console/utils/remove-boot-loader';
import '@fleetbase/leaflet-routing-machine';

export default class PortalRoute extends Route {
    @service('universe/hook-service') hookService;
    @service('universe/extension-manager') extensionManager;
    @service session;
    @service customerSession;
    @service hostRouter;
    @service notifications;

    @action loading(transition) {
        this.hookService.execute('customer-portal:portal:loading', this.session, this.hostRouter, transition);
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
        this.hookService.execute('customer-portal:portal:before-model', this.session, this.hostRouter, transition);

        if (this.session.isAuthenticated) {
            await this.extensionManager.waitForBoot();
            await this.session.promiseCurrentUser(transition);
            try {
                const customer = await this.customerSession.promiseCurrentCustomer();
                return customer;
            } catch (err) {
                this.session.invalidateWithLoader();
                this.notifications.error('No customer found for user account.');
            }
        }
    }

    afterModel() {
        removeBootLoader();
    }
}
