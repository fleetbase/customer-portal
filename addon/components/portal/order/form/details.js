import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { debug } from '@ember/debug';

export default class PortalOrderFormDetailsComponent extends Component {
    @service customerPortalOrderCreation;
    @service customFieldsRegistry;

    podOptions = ['scan', 'signature', 'photo'];

    @action async setOrderConfig(orderConfig) {
        this.customerPortalOrderCreation.setField('orderConfig', orderConfig);
        this.customerPortalOrderCreation.setField('customFields', null);

        if (!orderConfig) {
            return;
        }

        try {
            const customFields = await this.customFieldsRegistry.loadSubjectCustomFields.perform(orderConfig);
            this.customerPortalOrderCreation.setField('customFields', customFields);
        } catch (error) {
            debug(`Error loading customer portal order custom fields: ${error.message}`);
        }
    }

    @action setInput(field, event) {
        this.customerPortalOrderCreation.setField(field, event.target.value);
    }

    @action togglePodRequired() {
        this.customerPortalOrderCreation.setField('podRequired', !this.customerPortalOrderCreation.draft?.podRequired);
    }

    @action setPodMethod(podMethod) {
        this.customerPortalOrderCreation.setField('podMethod', podMethod);
    }
}
