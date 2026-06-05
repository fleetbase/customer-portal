import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { later } from '@ember/runloop';
import { timeout } from 'ember-concurrency';
import { isBlank } from '@ember/utils';
import config from 'ember-get-config';

export default class PortalOrderFormComponent extends Component {
    @service customerPortalOrderActions;
    @service customerPortalOrderCreation;
    @service customerPortalOrderValidation;
    @service customerPayment;
    @service currentUser;
    @service hostRouter;
    @service modalsManager;
    @service notifications;
    @service urlSearchParams;

    @tracked lastQuotedRevision = null;

    get draft() {
        return this.customerPortalOrderCreation.draft ?? this.args.model?.draft;
    }

    get canSubmit() {
        return this.customerPortalOrderValidation.canCreate(this.draft) && !this.isLoadingServiceQuotes;
    }

    get isLoadingServiceQuotes() {
        return this.customerPortalOrderActions.loadServiceQuotes.isRunning;
    }

    get canQuote() {
        return this.customerPortalOrderValidation.canQuote(this.draft);
    }

    get quoteRevision() {
        return this.draft?.quoteRevision;
    }

    get paymentConfig() {
        return this.draft?.paymentConfig ?? {};
    }

    get selectedServiceQuoteId() {
        const serviceQuote = this.draft?.serviceQuote;
        return serviceQuote?.uuid ?? serviceQuote?.id ?? serviceQuote;
    }

    get isPaymentRequired() {
        const hasServiceQuote = !isBlank(this.selectedServiceQuoteId);
        const stripeConfigured = typeof config.stripe?.publishableKey === 'string';
        const paymentsEnabled = this.paymentConfig.paymentsEnabled === true;
        const paymentsOnboardCompleted = this.paymentConfig.paymentsOnboardCompleted === true;

        return hasServiceQuote && stripeConfigured && paymentsEnabled && paymentsOnboardCompleted;
    }

    @action async initialize() {
        this.showCompletingPaymentDialog();

        try {
            const paymentConfig = await this.customerPortalOrderActions.loadPaymentConfig.perform();
            this.customerPortalOrderCreation.setField('paymentConfig', paymentConfig ?? {});

            if (this.shouldInitializeStripe(paymentConfig)) {
                await this.customerPayment.loadAndInitialize();
            }
        } catch (error) {
            this.notifications.serverError(error);
        }

        await this.checkForCheckoutSession();
        await this.refreshServiceQuotes();
    }

    @action async refreshServiceQuotes() {
        if (!this.canQuote || this.urlSearchParams.has('checkout_session_id')) {
            return;
        }

        const revision = this.quoteRevision;
        if (this.lastQuotedRevision === revision) {
            return;
        }
        this.lastQuotedRevision = revision;

        try {
            const serviceQuotes = await this.customerPortalOrderActions.loadServiceQuotes.perform(this.draft);
            this.customerPortalOrderCreation.setServiceQuotes(serviceQuotes);
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action cancel() {
        this.customerPortalOrderCreation.reset();
        this.hostRouter.transitionTo('customer-portal.portal.orders.index');
    }

    @action async submit() {
        if (!this.canSubmit) {
            return this.notifications.warning('Select an order type and at least two route stops before creating the order.');
        }

        if (this.isPaymentRequired && !this.draft?.purchaseRate) {
            return this.startCheckoutSession();
        }

        try {
            const order = await this.customerPortalOrderActions.createOrder.perform(this.draft);
            this.notifications.success('Order created.');
            this.customerPortalOrderCreation.reset();
            this.hostRouter.transitionTo('customer-portal.portal.orders.details', this.customerPortalOrderActions.identifier(order));
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    async startCheckoutSession() {
        try {
            await this.customerPayment.loadAndInitialize();
            const checkout = await this.customerPayment.initEmbeddedCheckout({
                fetchClientSecret: this.fetchClientSecret.bind(this),
            });
            const serviceQuote = this.draft.serviceQuote;

            this.saveCurrentOrderForCurrentServiceQuote(serviceQuote);
            await this.modalsManager.done();
            later(
                this,
                () => {
                    this.modalsManager.show('modals/service-quote-purchase-form', {
                        title: `Complete Payment for ${this.draft.orderConfig?.name ?? 'Order'} Service`,
                        modalClass: 'service-quote-extension-purchase',
                        modalFooterClass: 'hidden-i',
                        serviceQuote,
                        checkoutElementInserted: (el) => checkout.mount(el),
                        decline: async (modal) => {
                            checkout.destroy();
                            await modal.done();
                        },
                    });
                },
                100
            );
        } catch (error) {
            this.notifications.serverError(error, 'Unable to initialize secure checkout. Please try again.');
        }
    }

    async fetchClientSecret() {
        const { clientSecret } = await this.customerPortalOrderActions.createStripeCheckoutSession.perform(this.draft.serviceQuote, window.location.pathname);
        return clientSecret;
    }

    showCompletingPaymentDialog() {
        later(
            this,
            async () => {
                if (this.urlSearchParams.has('checkout_session_id') && this.urlSearchParams.has('service_quote')) {
                    await this.modalsManager.done();
                    this.modalsManager.show('modals/confirm-service-quote-purchase', {
                        title: 'Finalizing Purchase',
                        modalClass: 'finalize-service-quote-purchase',
                        loadingMessage: 'Completing purchase do not refresh or exit window...',
                        modalFooterClass: 'hidden-i',
                        backdropClose: false,
                    });
                }
            },
            300
        );
    }

    async checkForCheckoutSession() {
        if (!this.urlSearchParams.has('checkout_session_id') || !this.urlSearchParams.has('service_quote')) {
            return;
        }

        const checkoutSessionId = this.urlSearchParams.get('checkout_session_id');
        const serviceQuoteId = this.urlSearchParams.get('service_quote');

        this.restoreDraftForServiceQuote(serviceQuoteId);
        if (this.selectedServiceQuoteId !== serviceQuoteId) {
            this.notifications.error('Something went wrong trying to complete purchase.');
            return;
        }

        await timeout(300);

        try {
            const { status, purchaseRate } = await this.customerPortalOrderActions.getStripeCheckoutSessionStatus.perform(this.draft.serviceQuote, checkoutSessionId);
            if (purchaseRate) {
                this.customerPortalOrderCreation.setField('purchaseRate', purchaseRate);
            }

            if (status === 'complete' || status === 'purchase_complete') {
                this.urlSearchParams.removeParamFromCurrentUrl('checkout_session_id');
                this.urlSearchParams.removeParamFromCurrentUrl('service_quote');
                await this.submit();
                this.currentUser.setOption(`order:state:${serviceQuoteId}`, undefined);
                await this.modalsManager.done();
            }
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    saveCurrentOrderForCurrentServiceQuote(serviceQuote) {
        const serviceQuoteId = serviceQuote?.uuid ?? serviceQuote?.id;
        if (!serviceQuoteId) {
            return;
        }

        this.currentUser.setOption(`order:state:${serviceQuoteId}`, {
            draft: this.draft,
            serviceQuote,
        });
    }

    restoreDraftForServiceQuote(serviceQuoteId) {
        const state = this.currentUser.getOption(`order:state:${serviceQuoteId}`);
        if (!state?.draft) {
            this.customerPortalOrderCreation.setField('serviceQuote', { uuid: serviceQuoteId });
            return;
        }

        this.customerPortalOrderCreation.draft = {
            ...state.draft,
            serviceQuote: state.serviceQuote ?? state.draft.serviceQuote,
            serviceQuotes: state.draft.serviceQuotes?.length ? state.draft.serviceQuotes : [state.serviceQuote].filter(Boolean),
            purchaseRate: null,
        };
    }

    shouldInitializeStripe(paymentConfig = {}) {
        return paymentConfig.paymentsEnabled === true && paymentConfig.paymentsOnboardCompleted === true && typeof config.stripe?.publishableKey === 'string';
    }
}
