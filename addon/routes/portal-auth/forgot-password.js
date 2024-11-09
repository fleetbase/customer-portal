import Route from '@ember/routing/route';

export default class PortalAuthForgotPasswordRoute extends Route {
    queryParams = {
        email: {
            refreshModel: false,
        },
    };
}
