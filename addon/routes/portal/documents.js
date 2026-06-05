import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalDocumentsRoute extends Route {
    @service fetch;

    async model() {
        try {
            const response = await this.fetch.get('documents', {}, { namespace: 'customer-portal/int/v1' });

            return {
                documents: this.fetch.normalizeModel(response.documents ?? [], 'file'),
            };
        } catch {
            return { documents: [] };
        }
    }
}
