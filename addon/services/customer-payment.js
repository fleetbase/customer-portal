import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import config from 'ember-get-config';

let stripeJsPromise;

export default class CustomerPaymentService extends Service {
    @tracked stripe;
    @tracked loaded = false;

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
        const publishableKey = config.stripe?.publishableKey;

        if (!publishableKey) {
            throw new Error('Stripe is not configured for customer portal payments.');
        }

        if (typeof window === 'undefined' || typeof window.Stripe !== 'function') {
            throw new Error('Stripe could not be loaded. Please refresh and try again.');
        }

        this.stripe = window.Stripe(publishableKey, options);
        this.loaded = true;

        return this.stripe;
    }

    async loadAndInitialize(options = {}) {
        await this.load();

        return this.createStripeInstance(options);
    }

    async load() {
        if (typeof window !== 'undefined' && typeof window.Stripe === 'function') {
            this.loaded = true;
            return window.Stripe;
        }

        if (!config.stripe?.publishableKey) {
            this.loaded = false;
            throw new Error('Stripe is not configured for customer portal payments.');
        }

        if (stripeJsPromise) {
            await stripeJsPromise;
            this.loaded = typeof window.Stripe === 'function';
            return window.Stripe;
        }

        stripeJsPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-stripe-js="loaded"]');
            const script = existingScript ?? document.createElement('script');

            script.onload = () => {
                if (typeof window.Stripe === 'function') {
                    resolve(window.Stripe);
                } else {
                    reject(new Error('Stripe could not be loaded. Please refresh and try again.'));
                }
            };
            script.onerror = () => {
                stripeJsPromise = null;
                reject(new Error('Stripe could not be loaded. Please check your connection and try again.'));
            };

            if (!existingScript) {
                script.src = 'https://js.stripe.com/v3/';
                script.async = true;
                script.setAttribute('data-stripe-js', 'loaded');
                document.head.appendChild(script);
            }
        });

        await stripeJsPromise;
        this.loaded = typeof window.Stripe === 'function';

        return window.Stripe;
    }
}
