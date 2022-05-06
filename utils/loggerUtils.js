import log from 'loglevel';
import prefix from "loglevel-plugin-prefix"

export function getLogger(loggerName) {
    let logger = log.getLogger(loggerName);
    logger.setLevel('debug')
    prefix.apply(logger, {
        format(level, name, timestamp) {
            return `[${timestamp}] ${level} ${loggerName}:`
        },
    });
    return logger;
}
