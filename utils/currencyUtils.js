import fetch from 'node-fetch';
import {ChainId, Tokens, BaseToken} from "@synapseprotocol/sdk"
import {getIndexerLogger} from "./loggerUtils.js";
import {RedisConnection} from "../db/redis.js";
import {ethers, FixedNumber} from "ethers";

// API endpoints
const ANALYTICS_CHAIN_LIST = "https://synapse.dorime.org/api/v1/utils/chains"
const ANALYTICS_PRICE_API = "https://synapse.dorime.org/api/v1/utils/price"

// Tokens missing in currency API mapped to an existing one
export const MISSING_TOKENS_MAP = {
    '0x2b4618996fad3ee7bc9ba8c98969a8eaf01b5e20': '0x130025ee738a66e691e6a7a62381cb33c6d9ae83',
    '0x7f0a733b03ec455cb340e0f6af736a13d8fbb851': '0x130025ee738a66e691e6a7a62381cb33c6d9ae83',
    '0xf2001b145b43032aaf5ee2884e456ccd805f677d': '0x396c9c192dd323995346632581bef92a31ac623b',
    '0xa565037058df44f336e01683e096cdde45cfe5c2': '0xe3c82a836ec85311a433fbd9486efaf4b1afbf48',
    '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab': '0x19e1ae0ee35c0404f835521146206595d37981ae',
    '0x4f60a160d8c2dddaafe16fcc57566db84d674bd6': '0x997ddaa07d716995de90577c123db411584e5e46',
    '0x72cb10c6bfa5624dd07ef608027e366bd690048f': '0x28b42698caf46b4b012cf38b6c75867e0762186d',
    '0x6983d1e6def3690c4d616b13597a09e6193ea013': '0x0b5740c6b4a97f90ef2f0220651cca420b868ffb',
    '0xb12c13e66ade1f72f71834f2fc5082db8c091358': '0xd9eaa386ccd65f30b77ff175f6b52115fe454fd6'
}

// Init logger
let redisClient;
let logger = getIndexerLogger('currencyUtils');

// Get chain names for ids
let CHAIN_ID_TO_NAME = {}
await fetch(ANALYTICS_CHAIN_LIST).then(async res => {
    CHAIN_ID_TO_NAME = await res.json();
})

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
        logger.error(err)
    }
    return null
}


function getTokenPriceRedisKey(chainId, tokenAddress, date) {
    if (date) {
        return `${chainId}_${tokenAddress}_${date}_USD_PRICE`
    }
    return `${chainId}_${tokenAddress}_USD_PRICE`
}

function getFallbackTokenPriceRedisKey(chainId, tokenAddress, date) {
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
async function getTokenPriceRedis(chainId, tokenAddress, date, keyOverride = null) {
    if (!redisClient) {
        redisClient = await RedisConnection.getClient();
    }

    let key = keyOverride ? keyOverride : getTokenPriceRedisKey(chainId, tokenAddress, date)
    logger.debug(`Attempting to get cached price for ${key} from Redis`)

    let res = await redisClient.get(key)
    res = res ? res.substring(0, Math.min(18 - 1, res.length)) : res
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
async function putTokenPriceRedis(chainId, tokenAddress, date, price) {
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

    // TODO fix
    try {

        // Attempt to get price for date
        let res = await fetch(tokenPriceUrl);
        if (res.status !== 200) {

            // Fallback result for API failures
            logger.warn(`Attempting to get fallback price for ${tokenAddress} on chain ${chainId}, currency API is likely down!`);
            let fallbackRes = await getTokenPriceRedis(chainId, tokenAddress, date, getFallbackTokenPriceRedisKey(chainId, tokenAddress, date))
            if (fallbackRes) {
                logger.info(`Found fallback price for ${tokenAddress} on chain ${chainId} as ${fallbackRes}`);
                return fallbackRes
            }

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
