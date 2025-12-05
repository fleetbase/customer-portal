'use strict';
const { name } = require('../package');

module.exports = function (environment) {
    let ENV = {
        modulePrefix: name,
        mountedEngineRoutePrefix: 'customer-portal',
        environment,
    };

    return ENV;
};
