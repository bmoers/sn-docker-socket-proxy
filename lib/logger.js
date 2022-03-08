const { createLogger, format, transports } = require('winston');
const path = require('path');

const formatConfig = {
    json: [format.json()],
    text: [format.colorize(), format.simple()]
}

const logFormat = formatConfig[(process.env.LOG_FORMAT || 'text').toLowerCase()] || formatConfig.text;

if ('true' == process.env.LOG_LEVEL) {
    process.env.DEBUG = true
}

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        ...logFormat
    ),
    transports: [
        new transports.Console({
            handleRejections: true,
            handleExceptions: true
        }),
        //new transports.File({ filename: 'logs/combined.log' })
    ],
    exitOnError: true 
});

module.exports = {
    logger,
    topic: ({ filename } = { filename: 'default' }) => {
        const topic = path.relative(process.cwd(), filename).split('.').slice(0, -1).join('.')
        return logger.child({ topic })
    }
};
