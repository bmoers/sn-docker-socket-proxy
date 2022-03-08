require('dotenv').config();

const log = require('./lib/logger').topic(module);

const PORT = parseInt(process.env.PORT || 8080, 10);

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const app = express();

// configure ROARR logger for lightship
if ('json' == process.env.LOG_FORMAT) {
    process.env.ROARR_LOG = 'true'
}
const { createLightship } = require('lightship');
const lightshipOptions = {
    //detectKubernetes: false, -- for local development
    shutdownDelay: 0
};
if (process.env.K8S_READINESS_PORT) {
    lightshipOptions.port = parseInt(process.env.K8S_READINESS_PORT, 10);
}
const lightship = createLightship(lightshipOptions);


const supportedAuthStrategy = ['basic-auth', 'azure-ad'];
const supportedMw = ['dockerd', 'azure'];

const authStrategyName = (process.env.AUTH_STRATEGY || supportedAuthStrategy[0]).toLowerCase();
if (!supportedAuthStrategy.includes(authStrategyName)) {
    throw new Error(`Auth-Strategy ${authStrategyName} not found.`)
}

const middleWareName = (process.env.CREG_MIDDLE_WARE || supportedMw[0]).toLowerCase();
if (!supportedMw.includes(middleWareName)) {
    throw new Error(`Middleware ${middleWareName} not found.`)
}


const { authStrategy, strategyName } = require(`./strategies/${authStrategyName}`);

passport.use(authStrategy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.authenticate(strategyName, { session: false }));


const {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp,
} = require(`./mw/${middleWareName}`);


app.route('/:version?/images/json').get(async (req, res) => {
    const filters = req.query.filters ? JSON.parse(req.query.filters) : undefined;
    log.info(`:: getImage: ${req.url}, filters: ${JSON.stringify(filters)}`);

    const response = await getImage(filters);
    if (response.status > 299) {
        log.error('Request failed');
        log.error(`status : ${response.status}`)
        log.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});

app.route('/:version?/services/create').post(async (req, res) => {
    log.info(`:: createService: ${req.url}, body: ${JSON.stringify(req.body)}`);
    const response = await createService(req.body);
    if (response.status > 299) {
        log.error('Request failed');
        log.error(`status : ${response.status}`)
        log.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId/logs').get(async (req, res) => {
    log.info(`:: getLogs: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await getLogs(req.params.serviceId);
    if (response.status > 299) {
        log.error('Request failed');
        log.error(`status : ${response.status}`)
        log.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId').delete(async (req, res) => {
    log.info(`:: deleteService: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await deleteService(req.params.serviceId);
    if (response.status > 299) {
        log.error('Request failed');
        log.error(`status : ${response.status}`)
        log.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});

app.all('*', (req, res) => {
    const {
        method,
        url,
        body
    } = req;
    if (url != '/favicon.ico') {
        log.warn('Untracked request: %s, %s, %j', method, url, body);
    }
    res.sendStatus(404)
});

app.use((err, req, res) => {
    const {
        method,
        url,
        body
    } = req;
    log.error('Request errored: %s, %s, %j', method, url, body);
    log.error(err);
    res.status(500).send(err.message);
});

(async () => {

    log.info('--------------- ServiceNow Docker Socket Proxy ---------------')
    log.info(`     forwarding all requests to '${middleWareName}' middleware`)
    log.info(`     using auth strategy '${strategyName}'`)
    log.info('--------------------------------------------------------------');

    await cleanUp();

    lightship.registerShutdownHandler(async () => {

        log.info('Application Shutdown detected.');

        log.info('Cleanup ATF Test Runners');
        await cleanUp();

        log.info('Closing HTTP Application');
        app.close();

    });

    app.listen(PORT, () => {
        lightship.signalReady();
        log.info(`server listening on port ${PORT}`);

        const address = lightship.server.address();
        log.info(`lightship HTTP service is running on port ${address.port} -  /health, /live, /ready`);

    }).on('error', () => {
        lightship.shutdown();
    });

})()
