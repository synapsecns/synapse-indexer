import dotenv  from "dotenv"
dotenv.config({'path': '../../.env'})

import {ChainConfig, getW3Provider} from "../../config/chainConfig.js";

import {RedisConnection} from "../../db/redis.js";
let redisClient = await RedisConnection.getClient();

import {getIndexerLogger} from "../../utils/loggerUtils.js";
let logger = getIndexerLogger('laggingChainWorker');

let checkInterval = 1800000; // 1 hour

function checkLag(network, indexed) {
    let diff = Math.abs(network - indexed)
    if (diff > 500) {
        return {isLagging: true, diff}
    }
    return {isLagging: false, diff}
}

// Check if chain is lagging
async function run() {
    for (let key of Object.keys(ChainConfig)) {
        const chainId = ChainConfig[key].id
        const chainName = ChainConfig[key].name
        let w3Provider = getW3Provider(chainId);

        let networkLatestBlock = await w3Provider.getBlockNumber();
        let indexedLatestBlock = await redisClient.get(
            `${chainName}_LATEST_BLOCK_INDEXED`
        )
        indexedLatestBlock = parseInt(indexedLatestBlock)

        let lag = checkLag(networkLatestBlock, indexedLatestBlock)
        if (lag.isLagging) {
            // Alert setup in datadog
            logger.error(`${chainName} is lagging by ${lag.diff}`)
        }

        logger.info(`${chainName} - ${lag.diff}`)
    }
}

while (true) {
    try {
        await run()
        await new Promise(r => setTimeout(r, checkInterval));
    } catch (err) {
        logger.error(`Worker crashed - ${err}`)
    }
}
