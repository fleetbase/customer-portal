import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalOrdersRoute extends Route {
    @service customerPortalOrderActions;

    queryParams = {
        query: { refreshModel: true },
    };

    async model(params) {
        const orders = await this.customerPortalOrderActions.loadOrders.perform({ query: params.query });
        return { orders };
    }
}
