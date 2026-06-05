import Component from '@glimmer/component';

export default class PortalOrderDetailsTrackingComponent extends Component {
    get normalizedStatus() {
        return String(this.args.resource?.status ?? '').toLowerCase();
    }

    get hasStarted() {
        return ['started', 'in-progress', 'in_progress', 'driver-enroute', 'driver_enroute', 'enroute', 'in-transit', 'in_transit'].includes(this.normalizedStatus);
    }

    get isDispatchedWaitingStart() {
        return ['dispatched', 'assigned', 'accepted'].includes(this.normalizedStatus);
    }

    get isCreatedWaitingDispatch() {
        return !this.normalizedStatus || ['created', 'pending', 'scheduled', 'ready'].includes(this.normalizedStatus);
    }

    get shouldShowLiveEta() {
        return this.hasTrackerData && this.hasStarted;
    }

    get lifecycleMessage() {
        if (this.shouldShowLiveEta) {
            return null;
        }

        if (this.isDispatchedWaitingStart) {
            return {
                icon: 'truck-ramp-box',
                title: 'Your order has been dispatched',
                body: 'The delivery team has accepted this order. Live ETA appears once the route is started.',
                status: 'dispatched',
            };
        }

        if (this.isCreatedWaitingDispatch) {
            return {
                icon: 'clipboard-check',
                title: 'Your order has not started yet',
                body: 'The request has been received and is waiting for dispatch. Tracking updates will appear here as the order moves.',
                status: 'created',
            };
        }

        return {
            icon: 'location-crosshairs',
            title: 'Tracking is not available yet',
            body: 'Live ETA and route progress will appear as soon as movement data is available for this order.',
            status: this.normalizedStatus || 'pending',
        };
    }

    get trackerData() {
        return this.args.resource?.tracker_data ?? null;
    }

    get hasTrackerData() {
        return Boolean(this.trackerData);
    }

    get activeStop() {
        return this.trackerData?.active_stop ?? null;
    }

    get route() {
        return this.trackerData?.route ?? {};
    }

    get eta() {
        return this.trackerData?.eta ?? this.args.resource?.eta ?? {};
    }

    get activeEtaSeconds() {
        return this.activeStop?.eta_seconds ?? this.activeStop?.duration_in_traffic_s ?? this.activeStop?.duration_s ?? this.eta?.active_stop_seconds ?? null;
    }

    get completionEtaAt() {
        return this.eta?.completion_at ?? this.trackerData?.eta?.completion_at ?? null;
    }

    get remainingDistance() {
        return this.route?.distance_m ?? null;
    }

    get remainingDuration() {
        return this.route?.duration_in_traffic_s ?? this.route?.duration_s ?? null;
    }

    get confidencePercent() {
        const confidence = this.trackerData?.confidence;

        if (typeof confidence === 'number') {
            return confidence > 1 ? Math.round(confidence) : Math.round(confidence * 100);
        }

        return null;
    }

    get updatedAt() {
        return this.trackerData?.generated_at ?? this.args.resource?.updated_at;
    }
}
