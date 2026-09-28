import { module, test } from 'qunit';
import { setupTest } from 'dummy/tests/helpers';
import Service from '@ember/service';

const NAMESPACE = { namespace: 'customer-portal/int/v1' };

class IntlStub extends Service {
    t(key) {
        return key;
    }
}

class NotificationsStub extends Service {
    warnings = [];
    errors = [];
    warning(m) {
        this.warnings.push(m);
    }
    error(m) {
        this.errors.push(m);
    }
    serverError(e) {
        this.errors.push(e);
    }
}

module('Unit | Controller | portal-auth/login', function (hooks) {
    setupTest(hooks);

    hooks.beforeEach(function () {
        const self = this;
        this.persisted = [];
        this.authenticateCalls = [];
        this.transitions = [];
        this.posted = [];
        this.gets = [];

        // Defaults: no 2FA, the password is accepted and authentication succeeds.
        this.loginResult = () => Promise.resolve({ token: 'auth-token', type: 'customer' });
        this.authenticateResult = () => Promise.resolve();
        this.transitionResult = () => Promise.resolve();
        this.isAuthenticated = true;

        class SessionStub extends Service {
            store = {
                persist(data) {
                    self.persisted.push(data);
                    return Promise.resolve();
                },
            };
            get isAuthenticated() {
                return self.isAuthenticated;
            }
            authenticate(...args) {
                self.authenticateCalls.push(args);
                return self.authenticateResult();
            }
            setRedirect() {}
        }
        class UrlSearchParamsStub extends Service {
            get() {
                return undefined;
            }
        }
        class HostRouterStub extends Service {
            transitionTo(...args) {
                self.transitions.push(args);
                return self.transitionResult();
            }
        }
        class FetchStub extends Service {
            get(path, query, options) {
                self.gets.push({ path, query, options });
                return Promise.resolve({ twoFaSession: null, isTwoFaEnabled: false });
            }
            post(path, payload, options) {
                self.posted.push({ path, payload, options });
                if (path === 'auth/login') {
                    return self.loginResult(payload);
                }
                return Promise.resolve({ token: 'verify-token', session: 'sess_1' });
            }
        }

        this.owner.register('service:intl', IntlStub);
        this.owner.register('service:notifications', NotificationsStub);
        this.owner.register('service:session', SessionStub);
        this.owner.register('service:url-search-params', UrlSearchParamsStub);
        this.owner.register('service:host-router', HostRouterStub);
        this.owner.register('service:fetch', FetchStub);

        this.controller = this.owner.lookup('controller:portal-auth/login');
        this.notifications = this.owner.lookup('service:notifications');

        this.submit = () => this.controller.login({ preventDefault() {} });
    });

    test('login refuses to submit without an identity or password', async function (assert) {
        await this.submit();
        this.controller.identity = 'customer@fleetbase.io';
        await this.submit();

        assert.strictEqual(this.notifications.warnings.length, 2);
        assert.deepEqual(this.posted, [], 'nothing is submitted');
        assert.deepEqual(this.authenticateCalls, []);
    });

    test('login checks the password then authenticates with the issued token', async function (assert) {
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';
        this.controller.rememberMe = true;

        await this.submit();

        assert.deepEqual(this.posted, [{ path: 'auth/login', payload: { identity: 'customer@fleetbase.io', password: 'hunter2', remember: true }, options: NAMESPACE }]);
        assert.deepEqual(
            this.authenticateCalls,
            [['authenticator:fleetbase', { identity: 'customer@fleetbase.io', authToken: 'auth-token' }, true, 'auth/login', NAMESPACE]],
            'the session is established with the issued token, not by sending the password again'
        );
        assert.deepEqual(this.gets, [], 'the identity-only two-factor check is never called');
        assert.strictEqual(this.controller.identity, null, 'the form is cleared on success');
        assert.strictEqual(this.controller.password, null);
        assert.false(this.controller.isLoading);
    });

    test('login diverts to two-factor only after the password is accepted', async function (assert) {
        this.loginResult = () => Promise.resolve({ isEnabled: true, twoFaSession: 'two-fa-token' });
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';

        await this.submit();

        assert.strictEqual(this.posted.at(0).path, 'auth/login', 'the password is checked first');
        assert.deepEqual(this.persisted, [{ identity: 'customer@fleetbase.io' }], 'the identity is persisted for the 2FA step');
        assert.deepEqual(this.transitions, [['customer-portal.portal-auth.two-fa', { queryParams: { token: 'two-fa-token' } }]]);
        assert.deepEqual(this.authenticateCalls, [], 'no session is established until the code is verified');
        assert.deepEqual(this.gets, [], 'the identity-only two-factor check is never called');
    });

    test('a wrong password never reaches two-factor', async function (assert) {
        this.loginResult = () => Promise.reject(new Error('These credentials do not match our records.'));
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'wrong';

        await this.submit();

        assert.strictEqual(this.controller.failedAttempts, 1, 'the attempt is counted');
        assert.strictEqual(this.notifications.errors.length, 1, 'the error is surfaced');
        assert.strictEqual(this.controller.password, null, 'the password is cleared');
        assert.deepEqual(this.transitions, [], 'the user is not sent to the 2FA step');
        assert.deepEqual(this.persisted, []);
        assert.deepEqual(this.authenticateCalls, []);
    });

    test('a failure during the two-factor handoff is reported', async function (assert) {
        this.loginResult = () => Promise.resolve({ isEnabled: true, twoFaSession: 'two-fa-token' });
        this.transitionResult = () => Promise.reject(new Error('cannot route'));
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';

        await assert.rejects(this.submit(), /cannot route/);
        assert.strictEqual(this.notifications.errors.length, 1);
        assert.strictEqual(this.controller.password, null, 'the password is cleared on error');
    });

    test('an account needing a reset is sent to forgot-password', async function (assert) {
        this.loginResult = () => Promise.reject(new Error('Password reset required to continue.'));
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';

        await this.submit();

        assert.deepEqual(this.transitions.at(-1), ['customer-portal.portal-auth.forgot-password', { queryParams: { email: 'customer@fleetbase.io' } }]);
        assert.deepEqual(this.authenticateCalls, []);
    });

    test('an unverified account is sent to email verification', async function (assert) {
        this.loginResult = () => Promise.reject(new Error('User is not verified.'));
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';

        await this.submit();

        assert.strictEqual(this.posted.at(-1).path, 'auth/create-verification-session');
        assert.strictEqual(this.transitions.at(-1)[0], 'customer-portal.portal-auth.verification');
    });

    test('a failure establishing the session after the password is accepted is surfaced', async function (assert) {
        this.authenticateResult = () => Promise.reject(new Error('session could not be restored'));
        this.controller.identity = 'customer@fleetbase.io';
        this.controller.password = 'hunter2';

        await this.submit();

        assert.strictEqual(this.controller.failedAttempts, 1);
        assert.strictEqual(this.notifications.errors.length, 1);
        assert.strictEqual(this.controller.password, null);
    });
});
