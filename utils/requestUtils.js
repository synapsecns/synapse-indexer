/***
 * Wraps any callable with a retry mechanism, primarily used for fault tolerance
 * against failing RPCs
 *
 * @param {function} callable
 * @param logger
 * @param chainName
 * @return {Promise<*>}
 */
export async function callRPCMethod(callable, logger, chainName="") {
    // Try to get txn receipt again and again until it fails
    let retryCnt = 0
    let maxReties = 3
    let res = null
    while (!res) {
        try {
            res = await callable();
        } catch (err) {
            retryCnt += 1
            logger.warn(`Call failed for callable ${callable.name} ${chainName} - Retry cnt - ${retryCnt}`)
            if (retryCnt > maxReties) {
                throw err
            }
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    return res
}
