import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

const CUSTOMER_PORTAL_NAMESPACE = 'customer-portal/int/v1';

export default class PortalAuthTwoFaRoute extends Route {
    @service fetch;
    @service notifications;
    @service router;
    @service session;

    queryParams = {
        token: {
            refreshModel: false,
            replace: true,
        },
        clientToken: {
            refreshModel: false,
            replace: true,
        },
    };

    /**
     * Executes before the model is loaded, used for validating 2FA session with the server.
     *
     * @param {Object} transition - The transition object representing the route transition.
     * @return {Promise} A promise that resolves if the 2FA session is valid, and rejects with an error otherwise.
     */
    beforeModel(transition) {
        // validate 2fa session with server
        let { token, clientToken } = transition.to.queryParams;

        return this.session.store.restore().then(({ identity }) => {
            if (!identity) {
                this.notifications.error('2FA failed to initialize.');
                return this.router.transitionTo('customer-portal.portal-auth.login');
            }

            return this.fetch
                .post('two-fa/validate', { token, identity, clientToken }, { namespace: CUSTOMER_PORTAL_NAMESPACE })
                .then(({ clientToken, expired }) => {
                    // handle when code expired
                    if (expired === true) {
                        return this.invalidateTwoFaSession(token, identity);
                    }

                    // clear session data after validated 2fa session
                    this.session.store.persist({
                        identity,
                        token,
                        clientToken,
                    });
                })
                .catch((error) => {
                    this.notifications.serverError(error);
                    return this.router.transitionTo('customer-portal.portal-auth.login');
                });
        });
    }

    /**
     * Sets up the controller, including client token and session expiration details.
     *
     * @param {Object} controller - The controller for the route.
     */
    setupController(controller) {
        super.setupController(...arguments);

        this.session.store.restore().then(({ clientToken, identity }) => {
            controller.clientToken = clientToken;
            controller.identity = identity;
            controller.twoFactorSessionExpiresAfter = controller.getExpirationDateFromClientToken(clientToken);
            controller.countdownReady = true;
        });
    }

    invalidateTwoFaSession(token, identity) {
        this.notifications.error('2FA authentication session has expired.');
        return this.fetch.post('two-fa/invalidate', { token, identity }, { namespace: CUSTOMER_PORTAL_NAMESPACE }).then(() => {
            return this.router.transitionTo('customer-portal.portal-auth.login');
        });
    }
}
