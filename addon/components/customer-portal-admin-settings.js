import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { isEmpty } from '@ember/utils';
import { task } from 'ember-concurrency';
import config from 'ember-get-config';

export default class CustomerPortalAdminSettingsComponent extends Component {
    @service fetch;
    @service notifications;
    @tracked accessUrlSlug;
    @tracked accessUrlSlugValidation;
    @tracked orderConfigs = [];
    @tracked serviceRates = [];
    @tracked enabledOrderConfigIds = [];
    @tracked enabledServiceRateIds = [];
    @tracked paymentsEnabled = false;
    @tracked paymentsOnboardCompleted = false;

    constructor() {
        super(...arguments);
        this.getConfig.perform();
    }

    get isStripeEnabled() {
        return window.stripeInstance !== undefined || !isEmpty(config.stripe?.publishableKey);
    }

    get saveDisabled() {
        return !this.accessUrlSlug || !this.accessUrlSlugValidation?.valid;
    }

    @task *getConfig() {
        try {
            const config = yield this.fetch.get('settings/config', {}, { namespace: 'customer-portal/int/v1' });
            if (config) {
                this.accessUrlSlug = config.accessUrlSlug;
                this.accessUrlSlugValidation = config.accessUrlSlugValidation;
                this.orderConfigs = config.orderConfigs ?? [];
                this.serviceRates = config.serviceRates ?? [];
                this.enabledOrderConfigIds = config.enabledOrderConfigIds ?? [];
                this.enabledServiceRateIds = config.enabledServiceRateIds ?? [];
                this.paymentsEnabled = config.paymentsEnabled === true;
                this.paymentsOnboardCompleted = config.paymentsOnboardCompleted === true;
            }
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *saveConfig() {
        const customerPortalConfig = {
            accessUrlSlug: this.accessUrlSlug,
            enabledOrderConfigIds: this.enabledOrderConfigIds,
            enabledServiceRateIds: this.enabledServiceRateIds,
            paymentsEnabled: this.paymentsEnabled,
        };

        try {
            const config = yield this.fetch.post('settings/config', { customerPortalConfig }, { namespace: 'customer-portal/int/v1' });
            this.enabledOrderConfigIds = config.enabledOrderConfigIds ?? this.enabledOrderConfigIds;
            this.enabledServiceRateIds = config.enabledServiceRateIds ?? this.enabledServiceRateIds;
            this.paymentsEnabled = config.paymentsEnabled === true;
            this.paymentsOnboardCompleted = config.paymentsOnboardCompleted === true;
            this.notifications.success('Customer portal settings saved.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *setAccessUrlSlug(accessUrlSlug = '') {
        this.accessUrlSlug = accessUrlSlug;

        try {
            this.accessUrlSlugValidation = yield this.fetch.post('settings/validate-access-url', { accessUrlSlug }, { namespace: 'customer-portal/int/v1' });
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action toggleOrderConfig(orderConfig) {
        this.enabledOrderConfigIds = this.toggleIdentifier(this.enabledOrderConfigIds, this.identifier(orderConfig));
    }

    @action toggleServiceRate(serviceRate) {
        this.enabledServiceRateIds = this.toggleIdentifier(this.enabledServiceRateIds, this.identifier(serviceRate));
    }

    @action togglePayments(enabled) {
        if (enabled && !this.isStripeEnabled) {
            this.paymentsEnabled = false;
            return this.notifications.warning('Stripe must be configured before customer portal payments can be enabled.');
        }

        if (enabled && !this.paymentsOnboardCompleted) {
            this.paymentsEnabled = false;
            return this.notifications.warning('Stripe onboarding must be completed before customer portal payments can be enabled.');
        }

        this.paymentsEnabled = enabled;
    }

    identifier(record) {
        return record?.uuid ?? record?.id ?? record?.public_id;
    }

    toggleIdentifier(ids = [], id) {
        if (!id) {
            return ids;
        }

        if (ids.includes(id)) {
            return ids.filter((candidate) => candidate !== id);
        }

        return [...ids, id];
    }
}
