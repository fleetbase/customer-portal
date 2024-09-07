import buildRoutes from 'ember-engines/routes';

export default buildRoutes(function () {
    this.route('portal-auth', { path: '/auth' }, function () {
        this.route('login');
        this.route('two-fa');
        this.route('verification');
        this.route('forgot-password');
        this.route('reset-password');
    });
    this.route('portal', { path: '/' }, function () {
        this.route('home');
        this.route('account');
        this.route('virtual', { path: '/:slug/:view' });
    });
});
