import Route from '@ember/routing/route';

export default class PortalAccountRoute extends Route {
    beforeModel() {
        this.transitionTo('portal.settings.account');
    }
}
