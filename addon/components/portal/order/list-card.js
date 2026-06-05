import Component from '@glimmer/component';

const COMPLETE_STATUSES = ['completed', 'delivered'];
const ACTIVE_STATUSES = ['dispatched', 'started', 'in_progress', 'driver_enroute', 'driver_nearby'];

export default class PortalOrderListCardComponent extends Component {
    get order() {
        return this.args.order ?? {};
    }

    get identifier() {
        return this.order.public_id ?? this.order.id;
    }

    get trackingNumber() {
        return this.order.tracking_number?.tracking_number ?? this.order.tracking_number ?? this.order.public_id ?? this.order.id;
    }

    get stops() {
        const payload = this.order.payload ?? {};
        const stops = [];

        if (payload.pickup) {
            stops.push({ type: 'pickup', place: payload.pickup });
        }

        (payload.waypoints ?? []).forEach((waypoint, index) => {
            stops.push({
                type: waypoint.type ?? 'waypoint',
                place: waypoint.place ?? waypoint,
                index: index + 1,
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

    get origin() {
        return this.stops[0];
    }

    get destination() {
        return this.stops[this.stops.length - 1];
    }

    get originAddress() {
        return this.addressForPlace(this.origin?.place);
    }

    get destinationAddress() {
        return this.addressForPlace(this.destination?.place);
    }

    get stopCount() {
        return this.stops.length;
    }

    get middleStopCount() {
        return Math.max(this.stopCount - 2, 0);
    }

    get isMultiStop() {
        return this.stopCount > 2;
    }

    get progressClass() {
        const status = this.order.status;

        if (COMPLETE_STATUSES.includes(status)) {
            return 'is-complete';
        }

        if (ACTIVE_STATUSES.includes(status)) {
            return 'is-active';
        }

        return 'is-pending';
    }

    get trackingSummary() {
        const tracking = this.order.tracker_data ?? this.order.tracking_data ?? this.order.tracking ?? {};
        return tracking.summary ?? tracking;
    }

    get etaLabel() {
        return (
            this.order.eta ??
            this.order.eta_at ??
            this.order.estimated_arrival_at ??
            this.trackingSummary.eta ??
            this.trackingSummary.estimated_arrival_at ??
            this.trackingSummary.destination_eta
        );
    }

    get distanceLabel() {
        const distance = [
            this.trackingSummary.route?.distance_m,
            this.trackingSummary.remaining_distance,
            this.trackingSummary.distance_remaining,
            this.trackingSummary.distance,
            this.order.tracker_data?.route?.distance_m,
            this.order.route?.distance_m,
            this.order.route?.distance,
            this.order.adhoc_distance,
            this.order.distance,
        ].find((value) => this.hasUsefulDistance(value));

        if (typeof distance === 'number') {
            return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
        }

        return distance;
    }

    get hasTrackingMeta() {
        return Boolean(this.etaLabel || this.distanceLabel);
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
