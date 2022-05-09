import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

let _LOGGER_CACHE = {}

export function getIndexerLogger(loggerName) {
    if (loggerName in _LOGGER_CACHE) {
        return _LOGGER_CACHE[loggerName]
    }

    let transportOptions = [];
    // Datadog logging
    if (process.env.DD_LOGGING_ENABLE) {
        const httpTransportOptions = {
            host: 'http-intake.logs.datadoghq.com',
            path: `/api/v2/logs?dd-api-key=${process.env.DD_API_KEY}&ddsource=nodejs&service=${process.env.DD_APP_NAME}`,
            ssl: true
        };
        transportOptions.push(new transports.Http(httpTransportOptions))
    }
    transportOptions.push(new transports.Console());

    const myFormat = printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${level}] ${label}: ${message}`;
    });

    return _LOGGER_CACHE[loggerName] = createLogger({
        level: 'debug',
        format: combine(
            label({ label: loggerName }),
            timestamp(),
            myFormat
        ),
        transports: transportOptions
    })
}
