import Component from '@glimmer/component';
import { arrayFor, valueFor } from '../../../../utils/model-access';

export default class PortalOrderDetailsServiceRateComponent extends Component {
    get purchaseRate() {
        return valueFor(this.args.resource, 'purchase_rate');
    }

    get serviceQuote() {
        return valueFor(this.purchaseRate, 'service_quote');
    }

    get items() {
        return arrayFor(valueFor(this.serviceQuote, 'items'));
    }

    get currency() {
        return valueFor(this.serviceQuote, 'currency') ?? valueFor(this.purchaseRate, 'currency') ?? valueFor(this.args.resource, 'currency');
    }

    get serviceName() {
        return valueFor(this.serviceQuote, 'service_name') ?? valueFor(this.serviceQuote, 'service_rate_name') ?? valueFor(this.serviceQuote, 'service_rate.name');
    }

    get subtotalAmount() {
        return this.items.reduce((total, item) => total + Number(valueFor(item, 'amount', 0)), 0);
    }

    get taxAmount() {
        return Number(valueFor(this.purchaseRate, 'tax') ?? valueFor(this.serviceQuote, 'tax') ?? 0);
    }

    get totalAmount() {
        return Number(valueFor(this.serviceQuote, 'amount') ?? valueFor(this.purchaseRate, 'amount') ?? this.subtotalAmount);
    }

    get hasPurchaseRate() {
        return Boolean(this.purchaseRate);
    }

    get hasSubtotalAdjustment() {
        return this.taxAmount > 0 || this.subtotalAmount !== this.totalAmount;
    }
}
