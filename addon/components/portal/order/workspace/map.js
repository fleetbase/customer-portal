import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class PortalOrderWorkspaceMapComponent extends Component {
    @service customerPortalOrderRoutePreview;

    willDestroy() {
        super.willDestroy(...arguments);
        this.customerPortalOrderRoutePreview.unregisterMap();
    }

    get center() {
        const firstMarker = this.markers[0];

        return {
            latitude: Number(firstMarker?.latitude) || 1.3521,
            longitude: Number(firstMarker?.longitude) || 103.8198,
        };
    }

    get markers() {
        return [
            ...this.customerPortalOrderRoutePreview.routePoints.map((point) => this.markerForRoutePoint(point)),
            ...this.customerPortalOrderRoutePreview.selectedOrderRoutePoints.map((point) => this.markerForRoutePoint(point, 'selected')),
        ].slice(0, 150);
    }

    markersForOrder(order, source = 'order') {
        const payload = order?.payload;
        const markers = [];

        if (payload?.pickup) {
            markers.push(this.markerForPlace(payload.pickup, order, 'Pickup', 'pickup', 0, source));
        }

        (payload?.waypoints ?? []).forEach((waypoint, index) => {
            markers.push(this.markerForPlace(waypoint.place ?? waypoint, order, `Stop ${index + 1}`, 'waypoint', index + 1, source));
        });

        if (payload?.dropoff) {
            markers.push(this.markerForPlace(payload.dropoff, order, 'Dropoff', 'dropoff', markers.length, source));
        }

        return markers.filter((marker) => marker?.latitude && marker?.longitude);
    }

    markerForPlace(place, order, label, type, sequence, source) {
        const coordinates = this.customerPortalOrderRoutePreview.coordinatesFromPlace(place);

        if (!coordinates) {
            return null;
        }

        return {
            ...place,
            id: `${source}-${order?.public_id ?? order?.id ?? 'draft'}-${type}-${sequence}`,
            order,
            label,
            source,
            type,
            latitude: coordinates[0],
            longitude: coordinates[1],
            icon: this.iconForMarker(type, sequence, source),
        };
    }

    markerForRoutePoint(point, source = 'draft') {
        return {
            ...(point.place ?? {}),
            id: point.id,
            order: null,
            label: point.label,
            source,
            type: point.type,
            latitude: point.coordinates[0],
            longitude: point.coordinates[1],
            icon: this.iconForMarker(point.type, point.index, source),
        };
    }

    iconForMarker(type, sequence, source) {
        const L = globalThis.L;

        if (!L?.divIcon) {
            return undefined;
        }

        const label = this.markerLabel(type, sequence);
        const markerType = ['pickup', 'dropoff', 'return'].includes(type) ? type : 'waypoint';

        return L.divIcon({
            className: 'portal-order-route-marker-icon',
            html: `<div class="portal-order-route-marker portal-order-route-marker-${markerType} portal-order-route-marker-${source}"><span>${label}</span></div>`,
            iconSize: [34, 42],
            iconAnchor: [17, 38],
            popupAnchor: [0, -36],
            tooltipAnchor: [0, -30],
        });
    }

    markerLabel(type, sequence) {
        if (type === 'pickup') {
            return 'P';
        }

        if (type === 'dropoff') {
            return 'D';
        }

        if (type === 'return') {
            return 'R';
        }

        return String(Number(sequence ?? 0) + 1);
    }

    @action setupMap(event) {
        this.customerPortalOrderRoutePreview.registerMap(event);
        this.syncRoutePreview();
    }

    @action syncRoutePreview() {
        if (this.args.selectedOrder) {
            this.customerPortalOrderRoutePreview.updateSelectedOrder(this.args.selectedOrder);
            return;
        }

        this.customerPortalOrderRoutePreview.clearSelectedOrder();
        this.customerPortalOrderRoutePreview.updateDraft(this.args.draft);
    }
}
