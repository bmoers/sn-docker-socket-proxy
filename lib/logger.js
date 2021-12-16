const { Roarr } = require("roarr");

const roarLogger = Roarr.child({
    package: 'socket-proxy'
});

const consoleLogger = {
    child: () => {
        return {
            ...console,
            getContext: () => { return {} },
            fatal: (...args) => { console.error(...args); },
        }
    }
};

module.exports.Logger = (process.env.ROARR_LOG == 'true') ? roarLogger : consoleLogger;
