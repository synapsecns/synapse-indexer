export function getEpochSeconds() {
    return Math.floor(Date.now() / 1000)
}

export function getCurrentISODate() {
    return new Date().toISOString().split('T')[0]
}

export function getISODateFromEpoch(timestamp) {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
}
