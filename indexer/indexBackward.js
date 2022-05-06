import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {getChainIndexerLogger} from "../utils/loggerUtils.js";
import {getEpochSeconds} from "../utils/timeUtils.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";

export async function indexBackward(chainConfig) {
    let logger = getChainIndexerLogger(chainConfig.name, indexBackward.name)
    let chainName = chainConfig.name;
    let redisClient = await RedisConnection.getClient();

    // Only one invocation should be running per chain
    let isIndexing = await redisClient.get(
        `${chainName}_IS_INDEXING_BACKWARD`
    )
    if (isIndexing === "true") {
        logger.log(`Already in progress, skipping call.`)
        return;
    }
    await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "true")

    try {
        let w3Provider = getW3Provider(chainConfig.id, chainConfig.rpc);

        logger.log(`start indexing backward`)

        // Get the oldest block indexed
        let oldestBlockIndexed = await redisClient.get(
            `${chainName}_OLDEST_BLOCK_INDEXED`
        )
        if (!oldestBlockIndexed) {
            oldestBlockIndexed = await w3Provider.getBlockNumber();
        }

        // Get the block you wish to index until
        let startBlock = chainConfig.startBlock;

        // Backwards in blocks onf 500
        let minBlockIndexUntil = Math.min(
            startBlock,
            oldestBlockIndexed - 500
        )

        // Indexing is complete, return
        if (minBlockIndexUntil === startBlock) {
            logger.log(`indexing is complete. completed until start block ${startBlock}`);
            return;
        }

        logger.log(`oldest block indexed: ${oldestBlockIndexed}`);
        logger.log(`desired indexing until: ${startBlock}`);

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
        logger.log(`proceeding to process ${filteredEvents.length} retrieved events`)

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