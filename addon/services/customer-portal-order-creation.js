import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { arrayFor, valueFor } from '../utils/model-access';

export default class CustomerPortalOrderCreationService extends Service {
    @tracked draft;
    @tracked routePreview = [];

    start(orderConfigs = []) {
        this.draft = {
            orderConfig: orderConfigs[0],
            payload: {
                pickup: null,
                dropoff: null,
                return: null,
                waypoints: [],
                entities: [],
            },
            podRequired: false,
            podMethod: null,
            scheduledAt: null,
            notes: null,
            serviceQuote: null,
            serviceRates: [],
            serviceQuotes: [],
            quoteRevision: 0,
            paymentConfig: null,
            purchaseRate: null,
            files: [],
            customFields: null,
            isMultipleDropoffOrder: false,
        };
        this.routePreview = [];

        return this.draft;
    }

    reset() {
        this.draft = null;
        this.routePreview = [];
    }

    @action setField(field, value) {
        this.draft = { ...this.draft, [field]: value };
        this.invalidateQuotesForField(field);
    }

    @action setPayloadField(field, value) {
        this.draft = {
            ...this.draft,
            payload: {
                ...(this.draft?.payload ?? {}),
                [field]: value,
            },
        };
        this.invalidateQuotesForField(field);
    }

    @action toggleMultiDrop(isMultipleDropoffOrder = !this.draft?.isMultipleDropoffOrder) {
        const payload = this.draft?.payload ?? {};
        let nextPayload = { ...payload };

        if (isMultipleDropoffOrder) {
            const waypoints = payload.waypoints?.length ? payload.waypoints : this.waypointsFromPickupDropoff(payload);
            nextPayload = {
                ...nextPayload,
                pickup: null,
                dropoff: null,
                waypoints: this.ensureRequiredWaypoints(waypoints),
            };
        } else {
            const pickup = this.firstWaypointByType(payload.waypoints, 'pickup')?.place ?? payload.waypoints?.[0]?.place ?? null;
            const dropoff = this.firstWaypointByType(payload.waypoints, 'dropoff')?.place ?? payload.waypoints?.[1]?.place ?? null;
            nextPayload = {
                ...nextPayload,
                pickup,
                dropoff,
                waypoints: [],
            };
        }

        this.draft = { ...this.draft, isMultipleDropoffOrder, payload: nextPayload };
        this.invalidateServiceQuotes();
    }

    @action addWaypoint() {
        this.setPayloadField('waypoints', [...(this.draft?.payload?.waypoints ?? []), { place: null, type: 'dropoff' }]);
    }

    @action setWaypoint(index, place) {
        const waypoints = [...(this.draft?.payload?.waypoints ?? [])];
        waypoints[index] = { ...(waypoints[index] ?? {}), place, type: waypoints[index]?.type ?? this.defaultWaypointType(index) };
        this.setPayloadField('waypoints', waypoints);
    }

    @action setWaypointType(index, type) {
        const waypoints = [...(this.draft?.payload?.waypoints ?? [])];
        waypoints[index] = { ...(waypoints[index] ?? {}), type };
        this.setPayloadField('waypoints', waypoints);
    }

    @action sortWaypoints(sourceIndex, targetIndex) {
        if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) {
            return;
        }

        const waypoints = [...(this.draft?.payload?.waypoints ?? [])];
        const [waypoint] = waypoints.splice(sourceIndex, 1);
        waypoints.splice(targetIndex, 0, waypoint);
        this.setPayloadField('waypoints', waypoints);
    }

    @action removeWaypoint(index) {
        if (index < 2) {
            return;
        }

        const waypoints = [...(this.draft?.payload?.waypoints ?? [])];
        waypoints.splice(index, 1);
        this.setPayloadField('waypoints', waypoints);
    }

    @action addEntity() {
        this.setPayloadField('entities', [
            ...(this.draft?.payload?.entities ?? []),
            {
                name: null,
                sku: null,
                type: null,
                description: null,
                weight: null,
                weight_unit: 'kg',
                length: null,
                width: null,
                height: null,
                dimensions_unit: 'cm',
            },
        ]);
    }

    @action setEntityField(index, field, value) {
        const entities = [...(this.draft?.payload?.entities ?? [])];
        entities[index] = { ...(entities[index] ?? {}), [field]: value };
        this.setPayloadField('entities', entities);
    }

    @action removeEntity(entity) {
        this.setPayloadField(
            'entities',
            (this.draft?.payload?.entities ?? []).filter((candidate) => candidate !== entity)
        );
    }

    setServiceQuotes(serviceQuotes = []) {
        const quotes = arrayFor(serviceQuotes);
        const selected = quotes.length ? [...quotes].sort((a, b) => Number(valueFor(a, 'amount', 0)) - Number(valueFor(b, 'amount', 0)))[0] : null;

        this.draft = {
            ...this.draft,
            serviceQuotes: quotes,
            serviceQuote: selected,
        };
    }

    invalidateServiceQuotes() {
        if (!this.draft) {
            return;
        }

        this.draft = {
            ...this.draft,
            serviceQuotes: [],
            serviceQuote: null,
            purchaseRate: null,
            quoteRevision: (this.draft.quoteRevision ?? 0) + 1,
        };
    }

    invalidateQuotesForField(field) {
        if (['orderConfig', 'scheduledAt', 'pickup', 'dropoff', 'return', 'waypoints', 'entities'].includes(field)) {
            this.invalidateServiceQuotes();
        }
    }

    updateRoutePreview(coordinates = []) {
        this.routePreview = coordinates;
    }

    defaultWaypointType(index) {
        return index === 0 ? 'pickup' : 'dropoff';
    }

    waypointsFromPickupDropoff(payload = {}) {
        return [
            { place: payload.pickup ?? null, type: 'pickup' },
            { place: payload.dropoff ?? null, type: 'dropoff' },
        ];
    }

    ensureRequiredWaypoints(waypoints = []) {
        const normalized = waypoints.map((waypoint, index) => ({
            ...waypoint,
            type: waypoint?.type ?? this.defaultWaypointType(index),
        }));

        while (normalized.length < 2) {
            normalized.push({ place: null, type: this.defaultWaypointType(normalized.length) });
        }

        normalized[0] = { ...normalized[0], type: normalized[0].type ?? 'pickup' };
        normalized[1] = { ...normalized[1], type: normalized[1].type ?? 'dropoff' };

        return normalized;
    }

    firstWaypointByType(waypoints = [], type) {
        return waypoints.find((waypoint) => waypoint?.type === type && waypoint?.place);
    }
}
