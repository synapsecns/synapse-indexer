import {ethers} from "ethers";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {getIndexerLogger} from "../utils/loggerUtils.js";
import {getEpochSeconds} from "../utils/timeUtils.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";
import {RedisConnection} from "../db/redis.js"


export async function indexOlderTransactions(chainConfig) {
    let chainName = chainConfig.name;
    let logger = getIndexerLogger(`${chainName}_${indexOlderTransactions.name}`)

    try {
        let redisClient = await RedisConnection.getClient();
        let w3Provider = getW3Provider(chainConfig.id);

        // Initialize Bridge Contract
        let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
        let bridgeContract = buildBridgeContract(
            bridgeContractAddress,
            getBridgeContractAbi(),
            w3Provider
        )

        // Get the block you wish to index until
        let startBlock = await redisClient.get(
            `${chainName}_NEWEST_BACKINDEXED_BLOCK`
        )
        startBlock = startBlock ? parseInt(startBlock) : chainConfig.oldestBlock
        let endBlock = chainConfig.startBlock;

        for (let b = startBlock; b <= endBlock; b += 500) {

            logger.debug(`start indexing back to front from: ${b} to ${b + 500}`);
            // Get events between these blocks
            let filteredEvents = await bridgeContract.queryFilter(
                {
                    address: bridgeContractAddress,
                    topics: [
                        getTopicsHash()
                    ]
                },
                b,
                b + 500
            )

            // Process received events
            let startTime = getEpochSeconds();
            for (let event of filteredEvents) {
                try {
                    await processEvents(bridgeContract, chainConfig, [event])
                } catch (err) {
                    logger.warn(err)
                }
            }
            let endTime = getEpochSeconds();
            logger.debug(`processing ${chainName} blocks from ${b} to ${b + 500}  took ${endTime - startTime} seconds`)

            await redisClient.set(`${chainName}_NEWEST_BACKINDEXED_BLOCK`, b + 500)
        }
    } catch (err) {
        logger.error(err)
    }
}