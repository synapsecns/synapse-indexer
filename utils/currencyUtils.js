import fetch from 'node-fetch';
import {ChainId, Tokens, BaseToken} from "@synapseprotocol/sdk"
import {getIndexerLogger} from "./loggerUtils.js";
import {RedisConnection} from "../db/redis.js";
import {ethers, FixedNumber} from "ethers";

// Init logger
let redisClient;
let logger = getIndexerLogger('currencyUtils');

// Build map of addresses to token
let ADDRESS_TOKEN_MAP = {}
for (const chainId of Object.values(ChainId)) {
    ADDRESS_TOKEN_MAP[chainId] = {}
    for (const [symbol, _] of Object.entries(Tokens)) {
        if (Tokens[symbol] instanceof BaseToken) {
            const lowerAddress = Tokens[symbol].addresses[chainId]?.toLowerCase()
            ADDRESS_TOKEN_MAP[chainId][lowerAddress] = Tokens[symbol]
        }
    }
}

/**
 * Number of decimals to format value by
 *
 * @param chainId
 * @param address
 * @return {null|*}
 */
function getDecimalsForChainFromTokenAddress(chainId, address) {
    if (!chainId || !address) {
        return null
    }
    return ADDRESS_TOKEN_MAP[chainId][address?.toLowerCase()]?.decimals(chainId)
}


let BIGNUMBER_DECIMAL_MAP = {}
/**
 * Get base 10 divider for decimals, cached for performance
 *
 * @param decimals
 * @return {FixedNumber|*}
 */
export function getDivisorForDecimals(decimals) {
    if (decimals in BIGNUMBER_DECIMAL_MAP) {
        return BIGNUMBER_DECIMAL_MAP[decimals]
    }
    return BIGNUMBER_DECIMAL_MAP[decimals] = FixedNumber.from(
        ethers.utils.parseUnits("1", decimals)
    )
}

/***
 * Gets formatted value for a given value of a token on a chain
 * @param chainId
 * @param tokenAddress
 * @param value
 * @return {FixedNumber|null}
 */
export function getFormattedValue(chainId, tokenAddress, value) {
    try {
        if (!value) {
            return null
        }
        let bigValue = FixedNumber.from(value.toString())
        let decimals = getDecimalsForChainFromTokenAddress(chainId, tokenAddress)
        let bigDivisor = FixedNumber.from(getDivisorForDecimals(decimals).toString())
        let res = bigValue.divUnsafe(bigDivisor)
        return res
    } catch (err) {
        logger.error(`Could not get formatted value ${chainId} - ${tokenAddress}. Error is ${err}`)
    }
    return null
}


export function getTokenPriceRedisKey(chainId, tokenAddress, date) {
    tokenAddress = tokenAddress.toLowerCase()
    if (date) {
        return `${chainId}_${tokenAddress}_${date}_USD_PRICE`
    }
    return `${chainId}_${tokenAddress}_USD_PRICE`
}

export function getFallbackTokenPriceRedisKey(chainId, tokenAddress, date) {
    let originalKey = getTokenPriceRedisKey(chainId, tokenAddress, date)
    return `${originalKey}_FALLBACK`
}

/***
 * Gets a price for a token from Redis
 *
 * @param {String|Number} chainId
 * @param {String} tokenAddress
 * @param {String} date
 * @param {String} keyOverride
 * @return {Promise<FixedNumber|null>}
 */
export async function getTokenPriceRedis(chainId, tokenAddress, date, keyOverride = null) {
    if (!redisClient) {
        redisClient = await RedisConnection.getClient();
    }

    let key = keyOverride ? keyOverride : getTokenPriceRedisKey(chainId, tokenAddress, date)
    logger.debug(`Attempting to get cached price for ${key} from Redis`)

    let res = await redisClient.get(key)
    res = res ? res.substring(0, Math.min(18 - 1, res.length)) : res
    if (res) {
        logger.debug(`Got cached price for ${key} from Redis as ${res}`)
    }
    return res ? FixedNumber.from(res) : null
}

/***
 * Sets a price for a token in Redis
 *
 * @param {String|Number} chainId
 * @param {String} tokenAddress
 * @param {String} date
 * @param {Number} price
 * @return {Promise<FixedNumber>}
 */
export async function putTokenPriceRedis(chainId, tokenAddress, date, price) {
    let key = getTokenPriceRedisKey(chainId, tokenAddress, date)
    logger.debug(`Caching price for ${key} in Redis as ${price}`)

    if (date) {
        await redisClient.set(key, price)
    } else {
        // Set a TTL for current price
        await redisClient.set(key, price, 'EX', 3600)
    }

    // Also store fallback key, in case of currency API requests failures
    let fallbackKey = getFallbackTokenPriceRedisKey(chainId, tokenAddress, date)
    await redisClient.set(fallbackKey, price)

    return FixedNumber.from(price.toString())
}

/***
 * Gets the USD price for a token on a given chain from Synapse Analytics API
 * Caches the result in Redis
 *
 * @param chainId
 * @param tokenAddress
 * @param date
 * @return {Promise<FixedNumber|null>}
 */

export async function getCachedUSDPriceForChainToken(chainId, tokenAddress, date = null) {
    let cachedRes = await getTokenPriceRedis(chainId, tokenAddress, date)
    if (cachedRes) {
        return cachedRes
    }
}
