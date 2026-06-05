import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class WidgetPendingActionsComponent extends Component {
    @service fetch;
    @tracked actions = [];
    @tracked error;

    constructor() {
        super(...arguments);
        this.load.perform();
    }

    @task *load() {
        try {
            const response = yield this.fetch.get('pending-actions', {}, { namespace: 'customer-portal/int/v1' });
            this.actions = response.actions ?? [];
            this.error = null;
        } catch {
            this.actions = [];
            this.error = 'Unable to load pending actions.';
        }
    }

    get rows() {
        return this.actions.map((action) => ({
            ...action,
            icon: action.icon ?? 'circle-exclamation',
            route: action.route ?? this.routeForType(action.type),
            model: action.model ?? action.model_id ?? action.id,
        }));
    }

    routeForType(type) {
        switch (type) {
            case 'support':
            case 'support_tickets':
                return 'portal.support';
            case 'billing':
            case 'invoice':
            case 'invoices':
                return 'portal.billing';
            case 'order':
            case 'orders':
                return 'portal.orders';
            default:
                return null;
        }
    }
}
