import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {getIndexerLogger} from "../utils/loggerUtils.js";
import {getEpochSeconds} from "../utils/timeUtils.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";

export async function indexBackward(chainConfig) {
    let logger = getIndexerLogger(`${chainConfig.name}_${indexBackward.name}`)
    let chainName = chainConfig.name;
    let redisClient = await RedisConnection.getClient();

    // Only one invocation should be running per chain
    let isIndexing = await redisClient.get(
        `${chainName}_IS_INDEXING_BACKWARD`
    )
    if (isIndexing === "true") {
        logger.debug(`already in progress, skipping interval call.`)
        return;
    }

    // Release lock in about 200 seconds
    await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "true", {
        'EX': 200
    })

    try {
        let w3Provider = getW3Provider(chainConfig.id);

        logger.log(`start indexing backward`)

        // Get the oldest block indexed
        let oldestBlockIndexed = await redisClient.get(
            `${chainName}_OLDEST_BLOCK_INDEXED`
        )
        oldestBlockIndexed = oldestBlockIndexed ?
            parseInt(oldestBlockIndexed) : await w3Provider.getBlockNumber();

        // Get the block you wish to index until
        let startBlock = chainConfig.startBlock;

        // Backwards in blocks of 500
        let minBlockIndexUntil = Math.max(
            startBlock,
            oldestBlockIndexed - 500
        )

        logger.log(`oldest block indexed: ${oldestBlockIndexed}`);
        logger.log(`indexing until: ${minBlockIndexUntil}`);
        logger.log(`desired indexing until: ${startBlock}`);

        // Indexing is complete, return
        if (minBlockIndexUntil === startBlock) {
            logger.log(`indexing is complete. completed until start block ${startBlock}`);
            return;
        }

        // Initialize Bridge Contract
        let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
        let bridgeContract = buildBridgeContract(
            bridgeContractAddress,
            getBridgeContractAbi(),
            w3Provider
        )

        // Get events between these blocks
        let filteredEvents = await bridgeContract.queryFilter(
            {
                address: bridgeContractAddress,
                topics: [
                    getTopicsHash()
                ]
            },
            minBlockIndexUntil,
            oldestBlockIndexed
        )

        // Process received events
        let startTime = getEpochSeconds();
        await processEvents(bridgeContract, chainConfig, filteredEvents)
        let endTime = getEpochSeconds();
        logger.log(`processing took ${endTime - startTime} seconds`)

        // Update the oldest block processed for chain
        await redisClient.set(`${chainName}_OLDEST_BLOCK_INDEXED`, minBlockIndexUntil)
        await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "false")

        await redisClient.disconnect()
    } catch (err) {
        logger.error(err)
        await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "false")
    }
}