import ResourceActionService, { service } from '@fleetbase/ember-core/services/resource-action';
import { restartableTask, task, timeout } from 'ember-concurrency';
import { valueFor } from '../utils/model-access';

const NAMESPACE = 'customer-portal/int/v1';

function normalizeOptions(normalizeModelType) {
    return {
        namespace: NAMESPACE,
        normalizeToEmberData: true,
        normalizeModelType,
    };
}

export default class CustomerPortalOrderActionsService extends ResourceActionService {
    @service fetch;

    constructor() {
        super(...arguments);
        this.initialize('order', {
            modelNamePath: 'tracking_number.tracking_number',
            mountPrefix: 'customer-portal.portal',
        });
    }

    @task *loadOrders(params = {}) {
        return yield this.fetch.get('orders', params, normalizeOptions('order'));
    }

    @task *searchOrders(query) {
        yield timeout(300);
        return yield this.loadOrders.perform({ query });
    }

    @task *loadOrder(id) {
        return yield this.fetch.get(`orders/${id}`, {}, normalizeOptions('order'));
    }

    @task *loadOrderConfigs() {
        return yield this.fetch.get('order-configs', {}, normalizeOptions('order-config'));
    }

    @task *loadPlaces(params = {}) {
        return yield this.fetch.get('places/search', params, normalizeOptions('place'));
    }

    @task *searchPlaceCandidates(params = {}) {
        const response = yield this.fetch.get('places/search', params, { namespace: NAMESPACE });
        return Array.isArray(response?.places) ? response.places : [];
    }

    @task *createPlace(place = {}) {
        return yield this.fetch.post('places', place, normalizeOptions('place'));
    }

    @task *updatePlace(place = {}) {
        return yield this.fetch.patch(`places/${this.identifier(place)}`, place, normalizeOptions('place'));
    }

    @task *createOrder(draft) {
        return yield this.fetch.post('orders', this.serializeDraft(draft), normalizeOptions('order'));
    }

    @restartableTask *loadServiceQuotes(draft) {
        return yield this.fetch.post('service-quotes/preliminary', this.serializeQuoteRequest(draft), normalizeOptions('service-quote'));
    }

    @task *loadPaymentConfig() {
        return yield this.fetch.get('payments/config', {}, { namespace: NAMESPACE });
    }

    @task *createStripeCheckoutSession(serviceQuote, uri) {
        return yield this.fetch.post(
            'service-quotes/stripe-checkout-session',
            {
                service_quote: this.identifier(serviceQuote),
                uri,
            },
            { namespace: NAMESPACE }
        );
    }

    @task *getStripeCheckoutSessionStatus(serviceQuote, checkoutSessionId) {
        const response = yield this.fetch.get(
            'service-quotes/stripe-checkout-session',
            {
                service_quote: this.identifier(serviceQuote),
                checkout_session_id: checkoutSessionId,
            },
            { namespace: NAMESPACE }
        );

        if (response?.purchaseRate) {
            response.purchaseRate = this.fetch.jsonToModel(response.purchaseRate, 'purchase-rate');
        }

        return response;
    }

    @task *cancelOrder(order) {
        return yield this.fetch.post(`orders/${this.identifier(order)}/cancel`, {}, normalizeOptions('order'));
    }

    @task *rescheduleOrder(order, scheduledAt) {
        return yield this.fetch.post(`orders/${this.identifier(order)}/reschedule`, { scheduled_at: scheduledAt }, normalizeOptions('order'));
    }

    identifier(order) {
        return order?.uuid ?? order?.public_id ?? order?.id;
    }

    serializeDraft(draft = {}) {
        const serviceQuote = draft.serviceQuote;
        const purchaseRate = draft.purchaseRate;

        return {
            order_config: draft.orderConfig?.id ?? draft.orderConfig?.public_id ?? draft.orderConfig?.uuid,
            type: draft.orderConfig?.key,
            scheduled_at: draft.scheduledAt,
            notes: draft.notes,
            pickup: this.serializePlace(draft.payload?.pickup),
            dropoff: this.serializePlace(draft.payload?.dropoff),
            return: this.serializePlace(draft.payload?.return),
            waypoints: (draft.payload?.waypoints ?? [])
                .map((waypoint) => {
                    const place = this.serializePlace(waypoint.place ?? waypoint);
                    return place ? { ...place, type: waypoint.type ?? 'dropoff' } : null;
                })
                .filter((waypoint) => waypoint?.uuid || waypoint?.id || waypoint?.public_id || waypoint?.latitude || waypoint?.location || waypoint?.address || waypoint?.street1),
            entities: (draft.payload?.entities ?? []).filter((entity) => entity?.name || entity?.sku || entity?.description || entity?.type),
            pod_required: draft.podRequired,
            pod_method: draft.podMethod,
            service_quote_uuid: serviceQuote?.uuid ?? serviceQuote?.id ?? serviceQuote,
            purchase_rate_uuid: purchaseRate?.uuid ?? purchaseRate?.id ?? purchaseRate,
            files: (draft.files ?? []).map((file) => file?.uuid ?? file?.id ?? file).filter(Boolean),
        };
    }

    serializeQuoteRequest(draft = {}) {
        return {
            payload: {
                pickup: this.serializePlace(draft.payload?.pickup),
                dropoff: this.serializePlace(draft.payload?.dropoff),
                return: this.serializePlace(draft.payload?.return),
                waypoints: (draft.payload?.waypoints ?? [])
                    .map((waypoint) => {
                        const place = this.serializePlace(waypoint.place ?? waypoint);
                        return place ? { ...place, type: waypoint.type ?? 'dropoff' } : null;
                    })
                    .filter((waypoint) => waypoint?.uuid || waypoint?.id || waypoint?.public_id || waypoint?.latitude || waypoint?.location || waypoint?.address || waypoint?.street1),
                entities: (draft.payload?.entities ?? []).filter((entity) => entity?.name || entity?.sku || entity?.description || entity?.type),
            },
            service: 'all',
            service_type: draft.orderConfig?.key,
            scheduled_at: draft.scheduledAt,
            is_route_optimized: true,
        };
    }

    coordinatesFromOrder(order) {
        const payload = order?.payload;
        return this.coordinatesFromPlaces([payload?.pickup, ...(payload?.waypoints ?? []), payload?.dropoff]);
    }

    serializePlace(place) {
        if (!place) {
            return null;
        }

        const payload = {
            id: valueFor(place, 'id'),
            uuid: valueFor(place, 'uuid'),
            public_id: valueFor(place, 'public_id'),
            name: valueFor(place, 'name'),
            address: valueFor(place, 'address'),
            address_html: valueFor(place, 'address_html'),
            street1: valueFor(place, 'street1'),
            street2: valueFor(place, 'street2'),
            city: valueFor(place, 'city'),
            province: valueFor(place, 'province'),
            postal_code: valueFor(place, 'postal_code'),
            neighborhood: valueFor(place, 'neighborhood'),
            district: valueFor(place, 'district'),
            building: valueFor(place, 'building'),
            country: valueFor(place, 'country'),
            country_name: valueFor(place, 'country_name'),
            phone: valueFor(place, 'phone'),
            location: valueFor(place, 'location'),
            latitude: valueFor(place, 'latitude'),
            longitude: valueFor(place, 'longitude'),
            meta: valueFor(place, 'meta'),
            type: valueFor(place, 'type'),
        };

        return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== ''));
    }

    coordinatesFromPlaces(places = []) {
        return places
            .map((place) => {
                const subject = place?.place ?? place;
                const latitude = Number(subject?.latitude ?? subject?.lat);
                const longitude = Number(subject?.longitude ?? subject?.lng);
                return latitude && longitude ? [latitude, longitude] : null;
            })
            .filter(Boolean);
    }
}
