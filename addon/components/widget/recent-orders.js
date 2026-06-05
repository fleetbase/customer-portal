import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class WidgetRecentOrdersComponent extends Component {
    @service fetch;
    @tracked orders = [];
    @tracked error;

    constructor() {
        super(...arguments);
        this.load.perform();
    }

    @task *load() {
        try {
            const response = yield this.fetch.get('orders', { limit: 5 }, { namespace: 'customer-portal/int/v1' });
            this.orders = response.orders ?? response ?? [];
            this.error = null;
        } catch {
            this.orders = [];
            this.error = 'Unable to load recent orders.';
        }
    }

    get rows() {
        return this.orders.map((order) => this.rowForOrder(order));
    }

    rowForOrder(order) {
        const stops = this.stopsFor(order);
        const pickup = stops[0];
        const dropoff = stops[stops.length - 1];
        const middleStopCount = Math.max(stops.length - 2, 0);

        return {
            order,
            identifier: order.public_id ?? order.id,
            trackingNumber: this.trackingNumberFor(order),
            type: order.type,
            status: order.status,
            pickupAddress: this.addressForPlace(pickup?.place),
            dropoffAddress: this.addressForPlace(dropoff?.place),
            dropoffLabel: dropoff?.type === 'return' ? 'Return' : 'Dropoff',
            dropoffMarker: middleStopCount + 2,
            middleStopCount,
            date: order.scheduled_at ?? order.created_at,
            trackingMeta: this.trackingMetaFor(order),
        };
    }

    trackingNumberFor(order) {
        return order.tracking_number?.tracking_number ?? order.tracking_number ?? order.public_id ?? order.id;
    }

    stopsFor(order) {
        const payload = order.payload ?? {};
        const stops = [];

        if (payload.pickup) {
            stops.push({ type: 'pickup', place: payload.pickup });
        }

        (payload.waypoints ?? []).forEach((waypoint) => {
            stops.push({
                type: waypoint.type ?? 'waypoint',
                place: waypoint.place ?? waypoint,
            });
        });

        if (payload.dropoff) {
            stops.push({ type: 'dropoff', place: payload.dropoff });
        }

        if (payload.return) {
            stops.push({ type: 'return', place: payload.return });
        }

        return stops.filter((stop) => this.addressForPlace(stop.place));
    }

    trackingMetaFor(order) {
        const tracking = order.tracker_data ?? order.tracking_data ?? order.tracking ?? {};
        const summary = tracking.summary ?? tracking;
        const eta = order.eta ?? order.eta_at ?? order.estimated_arrival_at ?? summary.eta ?? summary.estimated_arrival_at ?? summary.destination_eta;

        if (eta) {
            return eta;
        }

        const distance = [
            summary.route?.distance_m,
            summary.remaining_distance,
            summary.distance_remaining,
            summary.distance,
            order.tracker_data?.route?.distance_m,
            order.route?.distance_m,
            order.route?.distance,
            order.adhoc_distance,
            order.distance,
        ].find((value) => this.hasUsefulDistance(value));

        if (typeof distance === 'number') {
            return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
        }

        return distance;
    }

    hasUsefulDistance(distance) {
        if (typeof distance === 'number') {
            return distance > 0;
        }

        return Boolean(distance);
    }

    addressForPlace(place) {
        return place?.address ?? place?.address_html ?? place?.street1 ?? place?.name;
    }
}
