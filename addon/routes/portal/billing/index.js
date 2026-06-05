import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalBillingIndexRoute extends Route {
    @service fetch;

    async model() {
        try {
            return await this.fetch.get('invoices', {}, { namespace: 'customer-portal/int/v1' });
        } catch {
            return { invoices: [] };
        }
    }
}
