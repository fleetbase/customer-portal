import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class CustomerSessionService extends Service {
    @service currentUser;
    @service fetch;
    @service notifications;
    @tracked customer = {};

    @task *loadCustomer() {
        try {
            this.customer = yield this.fetch.get('customers', { single: 1, user: this.currentUser.id }, { normalizeToEmberData: true, normalizeModelType: 'customer' });
            this.currentUser['customer'] = this.customer;
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    async promiseCurrentCustomer() {
        try {
            this.customer = await this.fetch.get('customers', { single: 1, user: this.currentUser.id }, { normalizeToEmberData: true, normalizeModelType: 'customer' });
            this.currentUser['customer'] = this.customer;
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    getCustomer() {
        return this.customer;
    }

    get(key, defaultValue = null) {
        const value = this.customer[key];
        if (value === undefined) {
            return defaultValue;
        }

        return value;
    }
}
