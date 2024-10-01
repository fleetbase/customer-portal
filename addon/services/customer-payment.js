import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { later } from '@ember/runloop';
import config from 'ember-get-config';

const STRIPE_JS_INITIALIZE_DELAY_MS = 900;
export default class CustomerPaymentService extends Service {
    @tracked stripe;
    @tracked loaded = false;

    constructor() {
        super(...arguments);
        this.loadAndInitialize();
    }

    async initEmbeddedCheckout() {
        if (!this.stripe) {
            await this.loadAndInitialize();
        }

        if (typeof this.stripe.initEmbeddedCheckout === 'function') {
            return this.stripe.initEmbeddedCheckout(...arguments);
        }

        throw new Error('Stripe not initialized!');
    }

    getInstance() {
        return this.stripe;
    }

    createStripeInstance(options = {}) {
        this.stripe = Stripe(config.stripe.publishableKey, options);
        return this.stripe;
    }

    async loadAndInitialize() {
        return new Promise((resolve) => {
            this.load(() => {
                resolve(this.createStripeInstance());
            });
        });
    }

    load(callback = null) {
        const stripeJs = document.querySelector('script[data-stripe-js="loaded"]');
        if (stripeJs) {
            later(
                this,
                () => {
                    if (typeof callback === 'function') {
                        callback();
                    }
                },
                STRIPE_JS_INITIALIZE_DELAY_MS
            );
            return;
        }

        // Create a new script element
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;

        // Use a data attribute to mark that the script is loaded
        script.setAttribute('data-stripe-js', 'loaded');
        script.onload = () => {
            this.loaded = true;
            later(
                this,
                () => {
                    if (typeof callback === 'function') {
                        callback();
                    }
                },
                STRIPE_JS_INITIALIZE_DELAY_MS
            );
        };

        // Append the script to the document's head
        document.head.appendChild(script);
    }
}
