const express = require('express');
const router = express.Router();

const {
    createProxyMiddleware,
    responseInterceptor
} = require('http-proxy-middleware');

const http = require('http');
const agent = new http.Agent({
    socketPath: "/var/run/docker.sock",
});

router.use(createProxyMiddleware({
    target: 'http://localhost/',
    agent,
    selfHandleResponse: true,
    onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {

        const exchange = `${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}]`;

        console.log('----------------------------------')
        console.log(exchange);
        console.log(`RESPONSE : `);

        // log original response
        console.dir(JSON.parse(buffer.toString('utf8')), {
            depth: null,
            colors: true,
            compact: false
        });
        return buffer;
    }),

    onProxyReq: (proxyReq, req, res, options) => {
        if (!req.body || !Object.keys(req.body).length) {
            return;
        }

        var bodyData = JSON.stringify(req.body);
        console.log('----------------------------------')
        console.log(`REQUEST : `);
        console.dir(req.body, {
            depth: null,
            colors: true,
            compact: false
        });

        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);

    },
    logLevel: 'debug',

}))

module.exports = router;
