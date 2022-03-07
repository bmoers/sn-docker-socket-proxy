const log = require('../lib/logger').topic(module);

const BearerStrategy = require('passport-azure-ad').BearerStrategy;


const mandatoryVars = ['AUTH_AZURE_TENANT_ID', 'AUTH_AZURE_CLIENT_ID'];
require('../lib/mandatory.js')(mandatoryVars);

const config = {
    credentials: {
        tenantID: process.env.AUTH_AZURE_TENANT_ID,
        clientID: process.env.AUTH_AZURE_CLIENT_ID,
        audience: process.env.AUTH_AZURE_AUDIENCE
    },
    resource: {
        scope: process.env.AUTH_AZURE_SCOPE ? process.env.AUTH_AZURE_SCOPE.split(',') : [],
        role: process.env.AUTH_AZURE_ROLE
    },
    metadata: {
        authority: 'login.microsoftonline.com',
        discovery: '.well-known/openid-configuration',
        version: 'v2.0'
    },
    settings: {
        validateIssuer: true,
        passReqToCallback: false,
        loggingLevel: 'warn'
    }
}

const options = {
    identityMetadata: `https://${config.metadata.authority}/${config.credentials.tenantID}/${config.metadata.version}/${config.metadata.discovery}`,
    issuer: `https://${config.metadata.authority}/${config.credentials.tenantID}/${config.metadata.version}`,
    clientID: config.credentials.clientID,
    audience: config.credentials.audience,
    validateIssuer: config.settings.validateIssuer,
    passReqToCallback: config.settings.passReqToCallback,
    loggingLevel: config.settings.loggingLevel
};

if (config.resource.scope.length) {
    options.scope = config.resource.scope;
}

const authStrategy = new BearerStrategy(options, (token, done) => {
    try {
        if (config.resource.role) {
            // user must have a specific role
            if (!(token.roles || []).includes(config.resource.role)) {
                return done(null, false, { message: 'Incorrect role.' });
            }
        }

        // Send user info using the second argument
        return done(null, { username: undefined }, token);
    } catch (err) {
        return done(err, null);
    }
});

const strategyName = 'oauth-bearer';

module.exports = {
    strategyName,
    authStrategy
}
