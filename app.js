require('dotenv').config();

const log = require('./lib/logger').topic(module);
const parsePayload = require('./lib/parse-payload');

const PORT = parseInt(process.env.PORT || 8080, 10);

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const app = express();
const schedule = require('node-schedule');


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
    throw new Error(`Auth-Strategy ${authStrategyName} not found in ${supportedAuthStrategy}.`)
}

const middleWareName = (process.env.CREG_MIDDLE_WARE || supportedMw[0]).toLowerCase();
if (!supportedMw.includes(middleWareName)) {
    throw new Error(`Middleware ${middleWareName} not found in ${supportedMw}.`)
}


const { authStrategy, strategyName } = require(`./strategies/${authStrategyName}`);

passport.use(authStrategy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.authenticate(strategyName, { session: false }));

const settings = {
    CONTAINER_CLEANUP_INTERVAL: parseInt((process.env.CONTAINER_TIMEOUT_MINS || 1440), 10)
}

const {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp,
    scheduleCleanUp,
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

    const { env } = parsePayload(req.body);
    if (env && env.TIMEOUT_MINS) {
        const timeout = parseInt(env.TIMEOUT_MINS, 10);
        if (timeout != settings.CONTAINER_CLEANUP_INTERVAL) {
            log.info('Updating CONTAINER_CLEANUP_INTERVAL to: %d', timeout)
            settings.CONTAINER_CLEANUP_INTERVAL = timeout
        }
    }

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
    log.info(`     Forwarding all requests to '${middleWareName}' middleware`)
    log.info(`     Using auth strategy '${strategyName}'`)
    log.info('--------------------------------------------------------------');

    await scheduleCleanUp(settings);

    log.info('Scheduled cleanup job at cron: \'%s\'', process.env.CONTAINER_CLEANUP_INTERVAL)

    const interval = (process.env.CONTAINER_CLEANUP_INTERVAL || '0 */5 * * * *').replace(/["']/g, '');
    const job = schedule.scheduleJob(interval, async () => {
        await scheduleCleanUp(settings);
    });

    lightship.registerShutdownHandler(async () => {

        log.info('Application shutdown detected.');

        log.info('Shutdown scheduled cleanup job');
        await job.gracefulShutdown();

        log.info('Cleanup unused atf test runners');
        await Promise.all([scheduleCleanUp(settings), cleanUp()]);

        log.info('Closing HTTP application');
        app.close();

    });

    app.listen(PORT, () => {
        lightship.signalReady();
        log.info(`Server listening on port ${PORT}`);

        const address = lightship.server.address();
        log.info(`Lightship HTTP service is running on port ${address.port} -  /health, /live, /ready`);

    }).on('error', () => {
        lightship.shutdown();
    });

})()
