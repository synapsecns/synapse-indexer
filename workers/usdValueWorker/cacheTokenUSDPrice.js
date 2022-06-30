// Attempt to get price for date
import dotenv  from "dotenv"
dotenv.config({path:'../../.env'})

import fetch from "node-fetch";
import {getFallbackTokenPriceRedisKey, getTokenPriceRedis, putTokenPriceRedis} from "../../utils/currencyUtils.js";

// API endpoints
const ANALYTICS_CHAIN_LIST = "https://analytics-api.bridgesyn.com/api/v1/utils/chains"
const ANALYTICS_PRICE_API = "https://analytics-api.bridgesyn.com/api/v1/utils/price"

// Tokens missing in currency API mapped to an existing one
const MISSING_TOKENS_MAP = {
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

// Get chain names for IDs
let CHAIN_ID_TO_NAME = {}
await fetch(ANALYTICS_CHAIN_LIST).then(async res => {
    CHAIN_ID_TO_NAME = await res.json();
})

export async function getAndCacheTokenUSDPrice(chainId, tokenAddress, date) {
    let chainName = CHAIN_ID_TO_NAME[chainId]
    if (!chainName) {
        console.error(`Unsupported chain with id ${chainId}`)
        return null
    }

    // Hack to get unsupported tokens
    if (tokenAddress in MISSING_TOKENS_MAP) {
        tokenAddress = MISSING_TOKENS_MAP[tokenAddress]
    } else if (tokenAddress.toLowerCase() in MISSING_TOKENS_MAP) {
        tokenAddress = MISSING_TOKENS_MAP[tokenAddress.toLowerCase()]
    }
    tokenAddress = tokenAddress.toLowerCase()

    try {

        // First try to get token price as normal
        let currentTokenPriceUrl = ANALYTICS_PRICE_API + `/${chainName}/${tokenAddress}`
        let tokenPriceUrl = date ? currentTokenPriceUrl + `?date=${date}` : currentTokenPriceUrl

        console.log(tokenPriceUrl)
        let res = await fetch(tokenPriceUrl);

        // Fallback result for API failures
        if (res.status !== 200) {
            console.log(`Attempting to get fallback price for ${tokenAddress} on chain ${chainId}, currency API is likely down!`);
            let fallbackRes = await getTokenPriceRedis(chainId, tokenAddress, date, getFallbackTokenPriceRedisKey(chainId, tokenAddress, date))
            if (fallbackRes) {
                console.log(`Found fallback price for ${tokenAddress} on chain ${chainId} as ${fallbackRes}`);
                return fallbackRes
            }

            throw new Error(`Invalid request, API status is ${res.status} for ${tokenPriceUrl}`)
        }
        let price = (await res.json())['price']

        // 0 implies price doesn't exist for date, fallback is to get current price
        if (date && price === 0) {
            console.warn(`No price available for token ${tokenAddress} on chain ${chainId} for date ${date}. Attempting to get current price`);
            res = await fetch(currentTokenPriceUrl);
            if (res.status !== 200) {
                throw new Error(`Invalid request, API status is ${res.status} for for ${currentTokenPriceUrl}`)
            }
            price = (await res.json())['price']
        }

        console.log(`Caching latest price for ${tokenAddress} on chain ${chainId}`);
        return await putTokenPriceRedis(chainId, tokenAddress, date, price);

    } catch (err) {
        console.error(`Error getting price for token ${tokenAddress} on chain ${chainId} for date ${date} - ${err.toString()}`);
    }
}