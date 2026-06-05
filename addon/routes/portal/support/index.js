import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalSupportIndexRoute extends Route {
    @service fetch;

    async model() {
        try {
            const issues = await this.fetch.get('issues', {}, { namespace: 'customer-portal/int/v1' });
            return { issues: issues.issues ?? issues };
        } catch {
            return { issues: [] };
        }
    }
}
