import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalAuthResetPasswordRoute extends Route {
    @service store;
    @service fetch;
    @service hostRouter;
    @service notifications;
    @service intl;

    async model({ id }) {
        return this.fetch.get('auth/validate-verification', { id });
    }

    async setupController(controller, model) {
        super.setupController(...arguments);
        if (model.is_valid === false) {
            this.notifications.warning(this.intl.t('auth.reset-password.invalid-verification-code'));
            return this.hostRouter.transitionTo('customer-portal.portal-auth');
        }

        // set brand to controller
        controller.brand = await this.store.findRecord('brand', 1);
    }
}
