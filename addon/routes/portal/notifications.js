import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalNotificationsRoute extends Route {
    @service fetch;

    async model() {
        try {
            return await this.fetch.get('notification-preferences', {}, { namespace: 'customer-portal/int/v1' });
        } catch {
            return { preferences: {} };
        }
    }

    setupController(controller, model) {
        super.setupController(controller, model);
        controller.preferences = { ...controller.preferences, ...(model.preferences ?? {}) };
    }
}
