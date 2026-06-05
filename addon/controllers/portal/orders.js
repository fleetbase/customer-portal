import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class PortalOrdersController extends Controller {
    @service customerPortalOrderActions;
    @service hostRouter;
    @service notifications;

    queryParams = ['view', 'query'];

    @tracked view = 'map';
    @tracked query = '';
    @tracked selectedOrder;

    get isTableView() {
        return this.view === 'table';
    }

    @action switchView(view) {
        this.view = view;
    }

    @action async search(query) {
        this.query = query;

        try {
            this.model.orders = await this.customerPortalOrderActions.searchOrders.perform(query);
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action setSelectedOrder(order) {
        this.selectedOrder = order;
    }

    @action clearSelectedOrder() {
        this.selectedOrder = null;
    }

    @action async reloadOrders() {
        try {
            this.model.orders = await this.customerPortalOrderActions.loadOrders.perform({ query: this.query });
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
