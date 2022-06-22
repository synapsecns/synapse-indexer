import fetch from 'node-fetch';
import {getIndexerLogger} from "./loggerUtils.js";

// API endpoints
const ANALYTICS_CHAIN_LIST = "https://synapse.dorime.org/api/v1/utils/chains"
const ANALYTICS_PRICE_API = "https://synapse.dorime.org/api/v1/utils/price"

// Init logger
let logger = getIndexerLogger('currencyUtils');

// Get chain names for ids
let CHAIN_ID_TO_NAME = {}
await fetch(ANALYTICS_CHAIN_LIST).then(async res => {
    CHAIN_ID_TO_NAME = await res.json();
})

/***
 *
 * @param chainId
 * @param tokenAddress
 * @param date
 * @return {Promise<number|null>}
 */

export async function getUSDPriceForChainToken(chainId, tokenAddress, date = null) {
    let chainName = CHAIN_ID_TO_NAME[chainId]
    if (!chainName) {
        logger.error(`Unsupported chain with id ${chainId}`)
        return null
    }

    let currentTokenPriceUrl = ANALYTICS_PRICE_API + `/${chainName}/${tokenAddress}`
    let tokenPriceUrl = date ? currentTokenPriceUrl + `?date=${date}` : currentTokenPriceUrl

    try {

        // Attempt to get price for date
        let res = await fetch(tokenPriceUrl);
        if (res.status !== 200) {
            throw new Error(`Invalid request, API status is ${res.status} for ${tokenPriceUrl}`)
        }
        let price = (await res.json())['price']

        // 0 implies price doesn't exist for date, fallback is to get current price
        if (date && price === 0) {
            logger.warn(`No price available for token ${tokenAddress} on chain ${chainId} for date ${date}. Attempting to get current price`);
            res = await fetch(currentTokenPriceUrl);
            if (res.status !== 200) {
                throw new Error(`Invalid request, API status is ${res.status} for for ${currentTokenPriceUrl}`)
            }
            price = (await res.json())['price']
        }

        // TODO: Cache in redis
        return price;

    } catch (err) {
        logger.error(`Error getting price for token ${tokenAddress} on chain ${chainId} for date ${date} - ${err.toString()}`);
    }

    return 0.0
}
