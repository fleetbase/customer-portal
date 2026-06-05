import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action, setProperties } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { restartableTask, timeout } from 'ember-concurrency';

export default class ModalsPortalOrderPlaceFormComponent extends Component {
    @service fetch;

    @tracked coordinatesInput;
    @tracked lookupResults = [];

    get place() {
        const place = this.args.options.place;

        if (place && typeof place.setProperties !== 'function') {
            place.setProperties = (properties = {}) => setProperties(place, properties);
        }

        return place;
    }

    get hasLookupResults() {
        return this.lookupResults.length > 0;
    }

    @restartableTask *lookupPlaces(query) {
        if (!query || query.length < 2) {
            this.lookupResults = [];
            return [];
        }

        yield timeout(250);

        const results = yield this.fetch.get('places/lookup', { query }, { namespace: 'customer-portal/int/v1' });
        this.lookupResults = Array.isArray(results) ? results : (results.places ?? []);

        return this.lookupResults;
    }

    @action searchStreet(event) {
        const query = event.target.value;
        this.place.setProperties({ street1: query });
        this.lookupPlaces.perform(query);
    }

    @action onAutocomplete(selected) {
        this.place.setProperties({ ...selected });
        this.lookupResults = [];

        if (this.coordinatesInput && selected.location) {
            this.coordinatesInput.updateCoordinates(selected.location);
        }
    }
}
