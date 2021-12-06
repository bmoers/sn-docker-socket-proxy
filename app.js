require("dotenv").config();

const PORT = 8080;

const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));



const supportedMw = ['dockerd', 'azure'];

const middleWare = (process.env.PROXY_MIDDLE_WARE || supportedMw[0]).toLowerCase();

if(!supportedMw.includes(middleWare)){
    throw new Error(`Middleware ${middleWare} not found.`)
}

const {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp
} = require(`./mw/${middleWare}`); 


app.route('/:version?/images/json').get(async (req, res) => {
    const filters = req.query.filters ? JSON.parse(req.query.filters) : undefined;
    console.log(`:: getImage: ${req.url}, filters: ${JSON.stringify(filters)}`);

    const response = await getImage(filters);
    return res.status(response.status).json(response.body);

});

app.route('/:version?/services/create').post(async (req, res) => {
    console.log(`:: createService: ${req.url}`);
    const response = await createService(req.body);
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId/logs').get(async (req, res) => {
    console.log(`:: getLogs: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await getLogs(req.params.serviceId);
    return res.status(response.status).json(response.body);

});
app.route('/:version?/services/:serviceId').delete(async (req, res) => {
    console.log(`:: deleteService: ${req.url}, serviceId: ${req.params.serviceId}`);
    const response = await deleteService(req.params.serviceId);
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

(async ()=>{

    console.log(`--------------- ServiceNow Docker Socket Proxy ---------------`)
    console.log(`     forwarding all requests to '${middleWare}' middleware`)
    console.log('--------------------------------------------------------------');

    await cleanUp();

    app.listen(PORT, () => {
        console.log(`server listening on port ${PORT}`);
    });

})()
