import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import IMask from 'imask';

export default class CustomerPortalUrlInputComponent extends Component {
    @tracked value;
    @tracked placeholder;
    @tracked imask;
    @tracked el;
    @tracked maskOptions;

    constructor(owner, { value = '', placeholder = '' }) {
        super(...arguments);
        this.value = value;
        this.placeholder = placeholder;

        const baseUrl = this.getBaseUrl();
        const escapedBaseUrl = this.escapeMaskChars(baseUrl);
        const escapedBaseSlug = this.escapeMaskChars('customer-access');

        this.maskOptions = {
            mask: `${escapedBaseUrl}/${escapedBaseSlug}/{slug}`,
            lazy: false,
            blocks: {
                slug: {
                    mask: /[a-z0-9-]*/,
                    prepare: function (str) {
                        return str.toLowerCase().replace(/\s+/g, '-');
                    },
                    commit: function (value, masked) {
                        masked._value = value.toLowerCase().replace(/\s+/g, '-');
                    },
                },
            },
        };
    }

    @action createMask(el) {
        this.el = el;
        this.imask = IMask(el, this.maskOptions);

        // Initialize the mask's value with the base URL and the slug
        if (this.value) {
            this.imask.value = `${this.getBaseUrl()}/customer-access/${this.value}`;
        } else {
            this.imask.value = `${this.getBaseUrl()}/customer-access/`;
        }

        this.imask.on('accept', () => {
            if (typeof this.args.onChange === 'function') {
                this.args.onChange(this.imask.unmaskedValue, this.imask);
            }
        });
    }

    getBaseUrl() {
        return window.location.origin;
    }

    escapeMaskChars(str) {
        return str.replace(/[[\]{}()*+?.\\^$|0a*]/g, '\\$&');
    }
}
