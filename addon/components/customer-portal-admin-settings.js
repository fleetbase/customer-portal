import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default class CustomerPortalAdminSettingsComponent extends Component {
    @service fetch;
    @service notifications;
    @tracked accessUrlSlug;
    @tracked accessUrlSlugValidation;

    constructor(owner) {
        super(...arguments);
        this.getConfig.perform();
    }

    @task *getConfig() {
        try {
            const config = yield this.fetch.get('settings/config', {}, { namespace: 'customer-portal/int/v1' });
            if (config) {
                this.accessUrlSlug = config.accessUrlSlug;
                this.accessUrlSlugValidation = config.accessUrlSlugValidation;
            }
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *saveConfig() {
        const customerPortalConfig = {
            accessUrlSlug: this.accessUrlSlug,
        };

        try {
            yield this.fetch.post('settings/config', { customerPortalConfig }, { namespace: 'customer-portal/int/v1' });
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
}
