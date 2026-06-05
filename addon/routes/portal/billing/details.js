import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalBillingDetailsRoute extends Route {
    @service fetch;

    async model(params) {
        const response = await this.fetch.get(`invoices/${params.id}`, {}, { namespace: 'customer-portal/int/v1' });
        return response.invoice ?? response;
    }
}
