import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class WidgetOpenTicketsComponent extends Component {
    @service fetch;
    @tracked total = 0;
    @tracked error;

    constructor() {
        super(...arguments);
        this.load.perform();
    }

    @task *load() {
        try {
            const response = yield this.fetch.get('issues/summary', {}, { namespace: 'customer-portal/int/v1' });
            this.total = response.open ?? 0;
            this.error = null;
        } catch {
            this.total = 0;
            this.error = 'Unable to load support tickets.';
        }
    }
}
