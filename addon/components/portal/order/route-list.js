import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

const ROUTE_COLOR = '#3485e2';

export default class PortalOrderRouteListComponent extends Component {
    @tracked isWaypointsCollapsed = true;

    get routeStops() {
        const payload = this.args.order?.payload;

        if (!payload) {
            return [];
        }

        const stops = [];

        if (payload.pickup) {
            stops.push(this.buildStop(payload.pickup, 'pickup', 1));
        }

        (payload.waypoints ?? []).forEach((waypoint, index) => {
            const place = waypoint.place ?? waypoint;
            stops.push(this.buildStop(place, waypoint.type ?? 'waypoint', stops.length + 1, waypoint, index + 1));
        });

        if (payload.dropoff) {
            stops.push(this.buildStop(payload.dropoff, 'dropoff', stops.length + 1));
        }

        if (payload.return) {
            stops.push(this.buildStop(payload.return, 'return', stops.length + 1));
        }

        return stops
            .map((stop) => ({
                ...stop,
                trackingStop: this.trackingStopFor(stop.place),
                routeLeg: this.routeLegFor(stop.place),
            }))
            .map((stop) => ({
                ...stop,
                etaSeconds: this.shouldShowEtaForStop(stop)
                    ? (stop.routeLeg?.eta_seconds ?? stop.routeLeg?.duration_in_traffic_s ?? stop.routeLeg?.duration_s ?? this.legacyEtaFor(stop.place))
                    : null,
                etaAt: this.shouldShowEtaForStop(stop) ? stop.routeLeg?.eta_at : null,
                distance: stop.routeLeg?.distance_m ?? null,
                duration: stop.routeLeg?.duration_in_traffic_s ?? stop.routeLeg?.duration_s ?? null,
                active: this.matchesStop(stop.trackingStop, this.args.order?.tracker_data?.active_stop),
                statusCode: stop.place?.status_code ?? stop.trackingStop?.status,
                showCompletedFlagBadge: this.shouldShowCompletedFlagBadge(stop),
            }));
    }

    get firstStop() {
        return this.routeStops[0] ?? null;
    }

    get middleStops() {
        return this.routeStops.slice(1, -1);
    }

    get lastStop() {
        return this.routeStops.length > 1 ? this.routeStops.at(-1) : null;
    }

    get hasExtraStops() {
        return this.routeStops.length > 2;
    }

    get routeDistance() {
        return this.args.order?.tracker_data?.route?.distance_m ?? null;
    }

    get routeDuration() {
        return this.args.order?.tracker_data?.route?.duration_in_traffic_s ?? this.args.order?.tracker_data?.route?.duration_s ?? null;
    }

    get hasRouteSummary() {
        return Boolean(this.routeDistance || this.routeDuration);
    }

    get shouldCollapseWaypoints() {
        return this.hasExtraStops;
    }

    buildStop(place, role, sequence, waypoint = null, waypointNumber = null) {
        const label = String(sequence);
        const markerColor = role === 'pickup' ? '#22C55E' : role === 'dropoff' ? '#EF4444' : role === 'return' ? '#F97316' : ROUTE_COLOR;

        return {
            place,
            role,
            label,
            title: role === 'pickup' ? 'Pickup' : role === 'dropoff' ? 'Dropoff' : role === 'return' ? 'Return' : `Stop ${waypointNumber ?? sequence}`,
            badgeStyle: `background-color: ${markerColor}; color: #ffffff;`,
            trackingNumberUuid: waypoint?.tracking_number_uuid ?? waypoint?.tracking_number?.uuid ?? null,
        };
    }

    trackingStopFor(place) {
        const stops = this.args.order?.tracker_data?.stops ?? [];
        return stops.find((stop) => this.matchesPlace(stop, place)) ?? null;
    }

    routeLegFor(place) {
        const legs = this.args.order?.tracker_data?.route?.legs ?? [];
        return legs.find((leg) => this.matchesPlace(leg.stop, place)) ?? null;
    }

    legacyEtaFor(place) {
        return this.args.eta?.[place?.id] ?? this.args.eta?.[place?.uuid] ?? this.args.eta?.[place?.public_id] ?? null;
    }

    matchesPlace(stop, place) {
        if (!stop || !place) {
            return false;
        }

        return stop.uuid === place.uuid || stop.public_id === place.public_id || stop.id === place.id;
    }

    matchesStop(stop, activeStop) {
        if (!stop || !activeStop) {
            return false;
        }

        return stop.uuid === activeStop.uuid || stop.public_id === activeStop.public_id;
    }

    shouldShowCompletedFlagBadge(stop) {
        if (!stop.trackingStop?.completed) {
            return false;
        }

        const visibleStatus = stop.statusCode ?? stop.place?.status_code ?? stop.trackingStop?.status_code ?? stop.trackingStop?.status ?? stop.place?.status;
        return typeof visibleStatus === 'string' ? visibleStatus.trim().toLowerCase() !== 'completed' : true;
    }

    shouldShowEtaForStop(stop) {
        const status = this.args.order?.status;
        return !['completed', 'done', 'canceled', 'cancelled'].includes(status) && !stop.trackingStop?.completed;
    }

    @action toggleWaypointsCollapse() {
        this.isWaypointsCollapsed = !this.isWaypointsCollapsed;
    }
}
