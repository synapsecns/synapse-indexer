import fetch from 'node-fetch';
import {getIndexerLogger} from "./loggerUtils.js";
import {RedisConnection} from "../db/redis.js";

// API endpoints
const ANALYTICS_CHAIN_LIST = "https://synapse.dorime.org/api/v1/utils/chains"
const ANALYTICS_PRICE_API = "https://synapse.dorime.org/api/v1/utils/price"

// Init logger
let redisClient;
let logger = getIndexerLogger('currencyUtils');

// Get chain names for ids
let CHAIN_ID_TO_NAME = {}
await fetch(ANALYTICS_CHAIN_LIST).then(async res => {
    CHAIN_ID_TO_NAME = await res.json();
})

function getTokenPriceRedisKey(chainId, tokenAddress, date) {
    if (date) {
        return `${chainId}_${tokenAddress}_${date}_USD_PRICE`
    }
    return `${chainId}_${tokenAddress}_USD_PRICE`
}

/***
 * Gets a price for a token from Redis
 *
 * @param {String|Number} chainId
 * @param {String} tokenAddress
 * @param {String} date
 * @return {Promise<*>}
 */
async function getTokenPriceRedis(chainId, tokenAddress, date) {
    let key = getTokenPriceRedisKey(chainId, tokenAddress, date)
    logger.debug(`Attempting to get cached price for ${key} from Redis`)

    let res = await redisClient.get(key)
    return res ? parseFloat(res) : null
}

/***
 * Sets a price for a token in Redis
 *
 * @param {String|Number} chainId
 * @param {String} tokenAddress
 * @param {String} date
 * @param {Number} price
 * @return {Promise<*>}
 */
async function putTokenPriceRedis(chainId, tokenAddress, date, price) {
    if (!redisClient) {
        redisClient = await RedisConnection.getClient();
    }

    let key = getTokenPriceRedisKey(chainId, tokenAddress, date)
    logger.debug(`Caching price for ${key} in Redis`)

    if (date) {
        await redisClient.set(key, price)
    } else {
        // Set a TTL for current price
        await redisClient.set(key, price, 'EX', 3600)
    }
    return price
}

/***
 * Gets the USD price for a token on a given chain from Synapse Analytics API
 * Caches the result in Redis
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

    let cachedRes = await getTokenPriceRedis(chainId, tokenAddress, date)
    if (cachedRes) {
        return cachedRes
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

        return await putTokenPriceRedis(chainId, tokenAddress, date, price);

    } catch (err) {
        logger.error(`Error getting price for token ${tokenAddress} on chain ${chainId} for date ${date} - ${err.toString()}`);
    }

    return null
}
