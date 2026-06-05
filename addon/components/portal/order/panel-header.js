import Component from '@glimmer/component';
import { format } from 'date-fns';

export default class PortalOrderPanelHeaderComponent extends Component {
    get resource() {
        return this.args.resource ?? {};
    }

    get trackingNumber() {
        return this.resource.tracking_number?.tracking_number ?? this.resource.tracking ?? this.resource.public_id ?? this.resource.id;
    }

    get qrCode() {
        return this.resource.tracking_number?.qr_code ?? this.resource.qr_code;
    }

    get createdAt() {
        return this.resource.createdAt ?? format(new Date(this.resource.created_at), 'PP HH:mm') ?? '-';
    }

    get dispatchedAt() {
        return this.resource.dispatchedAt ?? format(new Date(this.resource.dispatched_at), 'PP HH:mm') ?? '-';
    }
}
