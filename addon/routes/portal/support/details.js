import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class PortalSupportDetailsRoute extends Route {
    @service fetch;

    async model(params) {
        try {
            const response = await this.fetch.get(`issues/${params.id}`, {}, { namespace: 'customer-portal/int/v1' });

            return {
                issue: response.issue,
                comments: response.comments ?? [],
            };
        } catch {
            return {
                issue: null,
                comments: [],
            };
        }
    }

    setupController(controller, model) {
        super.setupController(controller, model);
        controller.comments = model.comments ?? [];
    }
}
