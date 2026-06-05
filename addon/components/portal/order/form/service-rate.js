import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { arrayFor, identifierFor, valueFor } from '../../../../utils/model-access';

export default class PortalOrderFormServiceRateComponent extends Component {
    @service customerPortalOrderCreation;

    get serviceRates() {
        return arrayFor(valueFor(this.args.draft, 'serviceRates'));
    }

    get serviceQuotes() {
        return arrayFor(valueFor(this.args.draft, 'serviceQuotes'));
    }

    get quoteOptions() {
        return this.serviceQuotes.map((serviceQuote) => {
            const currency = valueFor(serviceQuote, 'currency');

            return {
                model: serviceQuote,
                id: identifierFor(serviceQuote),
                serviceName: valueFor(serviceQuote, 'service_rate_name') ?? valueFor(serviceQuote, 'service_name') ?? valueFor(serviceQuote, 'public_id'),
                requestId: valueFor(serviceQuote, 'request_id'),
                amount: valueFor(serviceQuote, 'amount'),
                currency,
                items: arrayFor(valueFor(serviceQuote, 'items')).map((item) => ({
                    details: valueFor(item, 'details'),
                    amount: valueFor(item, 'amount'),
                    currency: valueFor(item, 'currency') ?? currency,
                })),
            };
        });
    }

    get hasQuoteOptions() {
        return this.quoteOptions.length > 0;
    }

    get hasServiceOptions() {
        return this.serviceRates.length > 0 || this.serviceQuotes.length > 0;
    }

    get shouldShowPanel() {
        return this.args.canQuote || this.args.isLoading || this.hasServiceOptions;
    }

    @action setServiceQuote(serviceQuote) {
        this.customerPortalOrderCreation.setField('serviceQuote', serviceQuote);
    }
}
