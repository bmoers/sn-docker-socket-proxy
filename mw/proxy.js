const log= require('../lib/logger').topic(module);

const express = require('express');
const router = express.Router();

const {
    createProxyMiddleware,
    responseInterceptor
} = require('http-proxy-middleware');

const http = require('http');
const agent = new http.Agent({
    socketPath: '/var/run/docker.sock',
});

router.use(createProxyMiddleware({
    target: 'http://localhost/',
    agent,
    selfHandleResponse: true,
    onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {

        const exchange = `${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}]`;

        log.info('----------------------------------')
        log.info(exchange);
        log.info('RESPONSE : ');

        // log original response
        log.info(JSON.parse(buffer.toString('utf8')));
        return buffer;
    }),

    onProxyReq: (proxyReq, req, res, options) => {
        if (!req.body || !Object.keys(req.body).length) {
            return;
        }

        var bodyData = JSON.stringify(req.body);
        log.info('----------------------------------')
        log.info('REQUEST : ');
        log.info(req.body);

        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);

    },
    logLevel: 'debug',

}))

module.exports = router;
