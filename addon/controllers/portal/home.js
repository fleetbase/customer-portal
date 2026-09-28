import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class PortalHomeController extends Controller {
    @service currentUser;
    @service customerSession;
    @service intl;

    get customerName() {
        return this.customerSession.get('name') || this.currentUser.name;
    }

    get accountTypeLabel() {
        return this.customerSession.accountType === 'vendor'
            ? this.intl.t('portal.home.company-workspace')
            : this.intl.t('portal.home.customer-workspace');
    }
}
