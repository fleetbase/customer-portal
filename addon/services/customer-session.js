import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class CustomerSessionService extends Service {
    @service currentUser;
    @service fetch;
    @service notifications;
    @tracked customer = {};
    @tracked account = {};
    @tracked accounts = [];

    @task *loadCustomer() {
        try {
            yield this.promiseCurrentCustomer();
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    async promiseCurrentCustomer() {
        try {
            const portalAccount = await this.fetch.get('account', {}, { namespace: 'customer-portal/int/v1' });
            this.customer = portalAccount.customer ?? portalAccount.account ?? {};
            this.account = portalAccount.account ?? this.customer;
            this.accounts = portalAccount.accounts ?? [];
            this.currentUser['customer'] = this.customer;
            this.currentUser['customerAccount'] = this.account;
        } catch (error) {
            this.customer = await this.fetch.get('customers', { single: 1, user: this.currentUser.id }, { normalizeToEmberData: true, normalizeModelType: 'customer' });
            this.account = this.customer;
            this.accounts = this.customer ? [this.customer] : [];
            this.currentUser['customer'] = this.customer;
            this.currentUser['customerAccount'] = this.account;
        }
    }

    getCustomer() {
        return this.customer;
    }

    getAccount() {
        return this.account || this.customer;
    }

    get accountId() {
        return this.get('uuid') || this.get('id');
    }

    get accountType() {
        return this.get('customer_type') || this.get('type') || 'contact';
    }

    get(key, defaultValue = null) {
        const source = this.account || this.customer || {};
        const value = source[key] ?? this.customer?.[key];
        if (value === undefined) {
            return defaultValue;
        }

        return value;
    }
}
