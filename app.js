const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


// curl --unix-socket /var/run/docker.sock http://localhost/containers/json

const {
    getImage,
    createService,
    getLogs,
    deleteService
} = require('./mw/dockerd');


app.route('/:version?/images/json').get(async (req, res) => {
    const response = await getImage(req.query.filters || {});
    return res.status(response.status).json(response.body);
});

app.route('/:version?/services/create').post(async (req, res) => {
    const response = await createService(req.body);
    return res.status(response.status).json(response.body);
});
app.route('/:version?/services/:serviceId/logs').get(async (req, res) => {
    const response = await getLogs(req.params.serviceId);
    return res.status(response.status).json(response.body);
});
app.route('/:version?/services/:serviceId').delete(async (req, res) => {
    const response = await deleteService(req.params.serviceId);
    return res.status(response.status).json(response.body);
});

app.all('*', (req, res, next) => {
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

app.use((err, req, res, next) => {
    const {
        method,
        url,
        body
    } = req;
    console.log('Request errored: ', method, url, body);
    console.error(err);
    res.status(500).send(err.message);
});
app.listen(3000, ()=>{
    console.log('server listening on port 3000');
});
