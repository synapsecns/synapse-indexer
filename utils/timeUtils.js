export function getEpochSeconds() {
    return Math.floor(Date.now() / 1000)
}

export function getCurrentISODate() {
    return new Date().toISOString().split('T')[0]
}
