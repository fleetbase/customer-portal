import Component from '@glimmer/component';

export default class PortalOrderDetailsRouteComponent extends Component {
    get trackerData() {
        return this.args.resource?.tracker_data ?? {};
    }

    get routeStopsCount() {
        const payload = this.args.resource?.payload ?? {};
        return [payload.pickup, ...(payload.waypoints ?? []), payload.dropoff, payload.return].filter(Boolean).length;
    }

    get hasRouteSummaryLine() {
        return this.routeStopsCount > 1;
    }

    get hasTrackingDistance() {
        return this.trackerData?.route?.distance_m !== null && this.trackerData?.route?.distance_m !== undefined;
    }

    get trackingDurationSeconds() {
        return this.trackerData?.route?.duration_in_traffic_s ?? this.trackerData?.route?.duration_s ?? null;
    }
}
