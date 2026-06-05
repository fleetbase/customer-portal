import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class WidgetUnpaidInvoicesComponent extends Component {
    @service fetch;
    @tracked total = 0;
    @tracked currency;
    @tracked error;

    constructor() {
        super(...arguments);
        this.load.perform();
    }

    @task *load() {
        try {
            const response = yield this.fetch.get('invoices/summary', {}, { namespace: 'customer-portal/int/v1' });
            this.total = response.balance ?? 0;
            this.currency = response.currency;
            this.error = null;
        } catch {
            this.total = 0;
            this.error = 'Unable to load invoices.';
        }
    }
}
