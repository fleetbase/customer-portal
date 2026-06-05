import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalSupportNewRoute extends Route {
    @service fetch;

    queryParams = {
        order_id: {
            refreshModel: true,
        },
    };

    async model(params) {
        try {
            const orders = await this.fetch.get('orders', {}, { namespace: 'customer-portal/int/v1' });
            return { orders: orders.orders ?? orders, orderId: params.order_id };
        } catch {
            return { orders: [], orderId: params.order_id };
        }
    }

    setupController(controller, model) {
        super.setupController(controller, model);

        controller.preselectOrder(model.orderId);
    }
}
