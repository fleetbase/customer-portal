import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

const DEFAULT_PREFERENCES = {
    order_created: true,
    order_dispatched: true,
    order_delayed: true,
    driver_nearby: true,
    order_delivered: true,
    invoice_due: true,
    invoice_paid: true,
    ticket_updated: true,
    document_available: true,
};

const PREFERENCE_GROUPS = [
    {
        title: 'Orders',
        description: 'Operational updates while your shipments move through dispatch and delivery.',
        keys: ['order_created', 'order_dispatched', 'order_delayed', 'driver_nearby', 'order_delivered'],
    },
    {
        title: 'Billing',
        description: 'Invoice and payment status updates from your account ledger.',
        keys: ['invoice_due', 'invoice_paid'],
    },
    {
        title: 'Support',
        description: 'Updates when your customer support tickets change.',
        keys: ['ticket_updated'],
    },
    {
        title: 'Documents',
        description: 'Alerts when labels, PODs, receipts, or related files are available.',
        keys: ['document_available'],
    },
];

export default class PortalNotificationsController extends Controller {
    @service fetch;
    @service notifications;

    @tracked preferences = { ...DEFAULT_PREFERENCES };

    constructor() {
        super(...arguments);
        this.preferences = { ...DEFAULT_PREFERENCES, ...(this.model?.preferences ?? {}) };
    }

    get preferenceGroups() {
        return PREFERENCE_GROUPS.map((group) => {
            return {
                ...group,
                items: group.keys.map((key) => {
                    return {
                        key,
                        label: this.preferenceLabel(key),
                        enabled: this.preferences[key],
                    };
                }),
            };
        });
    }

    preferenceLabel(key) {
        return key
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    @action setPreference(key, event) {
        this.preferences = { ...this.preferences, [key]: event.target.checked };
    }

    @task *savePreferences() {
        try {
            const response = yield this.fetch.post('notification-preferences', { preferences: this.preferences }, { namespace: 'customer-portal/int/v1' });
            this.preferences = response.preferences ?? this.preferences;
            this.notifications.success('Notification preferences saved.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
