import Route from '@ember/routing/route';

export default class PortalSettingsIndexRoute extends Route {
    beforeModel() {
        this.transitionTo('portal.settings.account');
    }
}
