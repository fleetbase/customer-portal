import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalOrdersNewRoute extends Route {
    @service customerPortalOrderActions;
    @service customerPortalOrderCreation;

    async model() {
        const [orderConfigs, places] = await Promise.all([this.customerPortalOrderActions.loadOrderConfigs.perform(), this.customerPortalOrderActions.loadPlaces.perform()]);
        const draft = this.customerPortalOrderCreation.start(orderConfigs);
        return { draft, orderConfigs, places };
    }
}
