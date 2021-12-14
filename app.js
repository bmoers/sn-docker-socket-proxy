require("dotenv").config();

const PORT = parseInt(process.env.PORT || 8080, 10);

const express = require('express');
const bodyParser = require('body-parser');
const passport = require("passport");
const app = express();


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
    cleanUp
} = require(`./mw/${middleWareName}`);


app.route('/:version?/images/json').get(async (req, res) => {
    const filters = req.query.filters ? JSON.parse(req.query.filters) : undefined;
    console.log(`:: getImage: ${req.url}, filters: ${JSON.stringify(filters)}`);

    const response = await getImage(filters);
    if(response.status > 299) {
        console.error('Request failed');
        console.error(`status : ${response.status}`)
        console.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});

app.route('/:version?/services/create').post(async (req, res) => {
    console.log(`:: createService: ${req.url}, body: ${JSON.stringify(req.body)}`);
    const response = await createService(req.body);
    if(response.status > 299) {
        console.error('Request failed');
        console.error(`status : ${response.status}`)
        console.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId/logs').get(async (req, res) => {
    console.log(`:: getLogs: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await getLogs(req.params.serviceId);
    if(response.status > 299) {
        console.error('Request failed');
        console.error(`status : ${response.status}`)
        console.error(`response : ${JSON.stringify(response.body)}`)
    }
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId').delete(async (req, res) => {
    console.log(`:: deleteService: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await deleteService(req.params.serviceId);
    if(response.status > 299) {
        console.error('Request failed');
        console.error(`status : ${response.status}`)
        console.error(`response : ${JSON.stringify(response.body)}`)
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
        console.log('Untracked request: ', method, url, body);
    }
    res.sendStatus(404)
});

app.use((err, req, res) => {
    const {
        method,
        url,
        body
    } = req;
    console.log('Request errored: ', method, url, body);
    console.error(err);
    res.status(500).send(err.message);
});

(async () => {

    console.log(`--------------- ServiceNow Docker Socket Proxy ---------------`)
    console.log(`     forwarding all requests to '${middleWareName}' middleware`)
    console.log(`     using auth strategy '${strategyName}'`)
    console.log('--------------------------------------------------------------');

    await cleanUp();

    app.listen(PORT, () => {
        console.log(`server listening on port ${PORT}`);
    });

})()
