import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class ModalsPortalConvertToCompanyComponent extends Component {
    @service customerSession;
    @service fetch;
    @service notifications;

    @tracked companyName;
    @tracked companyEmail;
    @tracked companyPhone;
    @tracked options = {};

    constructor(owner, { options }) {
        super(...arguments);
        this.options = options;
        this.companyName = this.customerSession.get('name');
        this.companyEmail = this.customerSession.get('email');
        this.companyPhone = this.customerSession.get('phone');
        this.setupOptions();
    }

    setupOptions() {
        this.options.title = 'Convert to Company Account';
        this.options.acceptButtonText = 'Convert Account';
        this.options.confirm = async (modal) => {
            modal.startLoading();

            try {
                await this.fetch.post(
                    'account/convert-to-vendor',
                    {
                        name: this.companyName || this.customerSession.get('name'),
                        email: this.companyEmail || this.customerSession.get('email'),
                        phone: this.companyPhone || this.customerSession.get('phone'),
                    },
                    { namespace: 'customer-portal/int/v1' }
                );

                this.notifications.success('Company account created.');

                if (typeof this.options.onConverted === 'function') {
                    this.options.onConverted();
                }

                modal.done();
            } catch (error) {
                this.notifications.serverError(error);
                modal.stopLoading();
            }
        };
    }
}
