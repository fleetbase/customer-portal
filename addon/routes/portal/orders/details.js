import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalOrdersDetailsRoute extends Route {
    @service customerPortalOrderActions;

    async model({ id }) {
        const order = await this.customerPortalOrderActions.loadOrder.perform(id);
        return { order };
    }

    setupController(controller, model) {
        super.setupController(controller, model);
        this.controllerFor('portal.orders').setSelectedOrder(model.order);
    }

    resetController() {
        this.controllerFor('portal.orders').clearSelectedOrder();
    }
}
