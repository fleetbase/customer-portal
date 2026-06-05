import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { arrayFor, valueFor } from '../../../utils/model-access';

const CLOSED_STATUSES = ['completed', 'done', 'canceled', 'cancelled'];

export default class PortalOrderDetailsComponent extends Component {
    @service customerPortalOrderActions;
    @service hostRouter;
    @service modalsManager;
    @service notifications;

    @tracked order = this.args.model?.order;

    get canModify() {
        return this.order && !CLOSED_STATUSES.includes(valueFor(this.order, 'status'));
    }

    get labelUrl() {
        const files = arrayFor(valueFor(this.order, 'files'));
        const labelFile = files.find((file) => ['label', 'order_label', 'shipping_label'].includes(valueFor(file, 'type')) || valueFor(file, 'meta.type') === 'label');

        return valueFor(this.order, 'label_url') ?? valueFor(this.order, 'tracking_number.label_url') ?? valueFor(labelFile, 'url');
    }

    get actionButtons() {
        return [
            {
                icon: 'ellipsis-h',
                type: 'default',
                size: 'sm',
                renderInPlace: true,
                items: [
                    {
                        text: 'View Label',
                        icon: 'file-invoice',
                        disabled: !this.labelUrl,
                        fn: this.viewLabel,
                    },
                    {
                        text: 'Create Support Ticket',
                        icon: 'headset',
                        fn: this.createSupportTicket,
                    },
                    {
                        separator: true,
                    },
                    {
                        text: 'Reschedule',
                        icon: 'calendar',
                        disabled: !this.canModify,
                        fn: this.openRescheduleModal,
                    },
                    {
                        separator: true,
                    },
                    {
                        text: 'Cancel Order',
                        icon: 'ban',
                        class: 'text-danger',
                        disabled: !this.canModify,
                        fn: this.confirmCancelOrder,
                    },
                ],
            },
        ];
    }

    @action close() {
        this.hostRouter.transitionTo('customer-portal.portal.orders.index');
    }

    @action viewLabel() {
        if (!this.labelUrl) {
            this.notifications.info('No label is available for this order yet.');
            return;
        }

        window.open(this.labelUrl, '_blank', 'noopener,noreferrer');
    }

    @action createSupportTicket() {
        this.hostRouter.transitionTo('customer-portal.portal.support.new', {
            queryParams: {
                order_id: this.customerPortalOrderActions.identifier(this.order),
            },
        });
    }

    @action openRescheduleModal() {
        const reschedule = {
            scheduled_at: this.order?.scheduled_at,
        };

        this.modalsManager.show('modals/portal-order-reschedule', {
            title: 'Reschedule Order',
            modalClass: 'modal-md',
            acceptButtonText: 'Reschedule',
            declineButtonText: 'Cancel',
            reschedule,
            confirm: () => this.rescheduleOrder(reschedule.scheduled_at),
        });
    }

    @action async confirmCancelOrder() {
        await this.modalsManager.confirm({
            title: 'Cancel this order?',
            body: 'This will cancel the delivery request for this order.',
            acceptButtonText: 'Cancel Order',
            acceptButtonType: 'danger',
            confirm: this.cancelOrder,
        });
    }

    @action async cancelOrder() {
        try {
            this.order = await this.customerPortalOrderActions.cancelOrder.perform(this.order);
            this.notifications.success('Order canceled.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action async rescheduleOrder(scheduledAt) {
        if (!scheduledAt) {
            this.notifications.warning('Choose a new delivery time before rescheduling.');
            return;
        }

        try {
            this.order = await this.customerPortalOrderActions.rescheduleOrder.perform(this.order, scheduledAt);
            this.notifications.success('Order rescheduled.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
