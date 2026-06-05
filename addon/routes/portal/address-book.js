import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalAddressBookRoute extends Route {
    @service fetch;

    async model() {
        try {
            return await this.fetch.get('address-book', {}, { namespace: 'customer-portal/int/v1' });
        } catch {
            return { places: [], contacts: [] };
        }
    }
}
