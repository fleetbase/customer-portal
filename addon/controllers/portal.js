import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class PortalController extends Controller {
    @service universe;
    @service session;
    @service currentUser;
    @service customerSession;
    @service intl;

    get accountName() {
        return this.customerSession.get('name') || this.currentUser.name;
    }

    get accountTypeLabel() {
        return this.customerSession.accountType === 'vendor'
            ? this.intl.t('portal.account-type.company')
            : this.intl.t('portal.account-type.customer');
    }

    get accountEmail() {
        return this.customerSession.get('email') || this.currentUser.email;
    }

    /**
     * Action to invalidate and log user out
     *
     * @void
     */
    @action invalidateSession() {
        this.session.invalidateWithLoader();
    }
}
