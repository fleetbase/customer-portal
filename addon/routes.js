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
        this.route('home', { path: '/' });
        this.route('orders', function () {
            this.route('index', { path: '/' });
            this.route('new');
            this.route('details', { path: '/:id' });
        });
        this.route('billing', function () {
            this.route('index', { path: '/' });
            this.route('details', { path: '/:id' });
        });
        this.route('support', function () {
            this.route('index', { path: '/' });
            this.route('new');
            this.route('details', { path: '/:id' });
        });
        this.route('documents');
        this.route('address-book');
        this.route('notifications');
        this.route('settings', function () {
            this.route('account');
            this.route('members');
        });
        this.route('account');
        this.route('virtual', { path: '/:slug' });
    });
});
