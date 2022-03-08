const { createLogger, format, transports } = require('winston');
const path = require('path');

const padLen = 'verbose'.length

const locFormat = format.printf(({ level, message, timestamp }) => {
    
    // eslint-disable-next-line no-control-regex
    const rawLen = level.replace(/\x1B\[\d+m/g, '').length;
    const colorDiff = level.length - rawLen;
    const levelString = `[${level}]`.padEnd(padLen + colorDiff + 2, ' ');

    return `${timestamp} ${levelString} ${message}`;
});

const formatConfig = {
    json: [format.json()],
    text: [format.colorize({ all: false }), locFormat]
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
