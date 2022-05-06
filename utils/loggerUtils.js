import log from 'loglevel';
import prefix from "loglevel-plugin-prefix"

// Call this in the init function
export function setupLogger() {
}

export function getChainIndexerLogger(chainId, operation) {
    prefix.reg(log);
    let loggerName = `${chainId}-${operation}`
    let logger = log.getLogger(loggerName);
    prefix.apply(logger, {
        format(level, name, timestamp) {
            return `[${timestamp}] ${level} ${chainId}_${operation}:`
        },
    });
    return logger;
}

export function getGenericLogger(operation) {
    prefix.reg(log);
    let loggerName = `${operation}`
    let logger = log.getLogger(loggerName);
    prefix.apply(logger, {
        format(level, name, timestamp) {
            return `[${timestamp}] ${level} ${operation}:`
        },
    });
    return logger;
}
