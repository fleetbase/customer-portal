import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class ApplicationRoute extends Route {
    @service store;
    @service theme;

    /**
     * Get the branding settings.
     *
     * @return {BrandModel}
     * @memberof ApplicationRoute
     */
    model() {
        return this.store.findRecord('brand', 1);
    }

    /**
     * Add the fleetbase-portal body class.
     *
     * @memberof ApplicationRoute
     */
    activate() {
        this.theme.setRoutebodyClassNames(['fleetbase-portal']);
    }
}
