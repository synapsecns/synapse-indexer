import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";

export async function indexBackward(chainConfig) {
    let chainName = chainConfig.name;
    let redisClient = await RedisConnection.getClient();

    // Only one invocation should be running per chain
    let isIndexing = await redisClient.get(
        `${chainName}_IS_INDEXING_BACKWARD`
    )
    if (isIndexing === "true") {
        console.log(`${chainName}: Indexing backward already in progress, skipping call.`)
        return;
    }
    await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "true")

    try {
        let w3Provider = getW3Provider(chainConfig.id, chainConfig.rpc);

        console.log(`${chainName}: Indexing backward for network`)

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
            console.log(`Backwards indexing complete for chain ${chainName} until block ${startBlock}`);
            return;
        }

        console.log(`${chainName}: oldest block indexed: ${oldestBlockIndexed}`);
        console.log(`${chainName}: desired indexing until: ${startBlock}`);

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
        console.log(`${chainName}: ${filteredEvents.length} older events retrieved, now processing...`)

        // Process received events
        let startTime = Math.floor(Date.now() / 1000)
        await processEvents(bridgeContract, chainConfig, filteredEvents)
        let endTime = Math.floor(Date.now() / 1000)
        console.log(`Processing old events took ${endTime - startTime} seconds`)

        // Update the oldest block processed for chain
        await redisClient.set(`${chainName}_OLDEST_BLOCK_INDEXED`, minBlockIndexUntil)
        await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "false")

        await redisClient.disconnect()
    } catch (err) {
        console.error(err)
        await redisClient.set(`${chainName}_IS_INDEXING_BACKWARD`, "false")
    }
}