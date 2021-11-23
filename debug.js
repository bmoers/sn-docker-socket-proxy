const proxyMiddleware = require('./proxy-middleware');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(proxyMiddleware);
app.listen(8443);
