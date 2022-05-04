import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";

export async function indexForward(chainConfig) {
    let chainName = chainConfig.name;
    let redisClient = await RedisConnection.getClient();

    // Only one invocation should be running per chain
    let isIndexing = await redisClient.get(
        `${chainName}_IS_INDEXING_FORWARD`
    )
    if (isIndexing === "true") {
        console.log(`${chainName}: Indexing forward already in progress, skipping interval call.`)
        return;
    }
    await redisClient.set(`${chainName}_IS_INDEXING_FORWARD`, "true")

    try {
        let w3Provider = getW3Provider(chainConfig.id, chainConfig.rpc);
        console.log(`${chainName}: Indexing forward for network`)

        // Get block intervals to get events between
        let networkLatestBlock = await w3Provider.getBlockNumber();
        let indexedLatestBlock = await redisClient.get(
            `${chainName}_LATEST_BLOCK_INDEXED`
        )
        indexedLatestBlock = (indexedLatestBlock) ? parseInt(indexedLatestBlock) : networkLatestBlock;

        if (indexedLatestBlock === networkLatestBlock) {
            console.log(`Already forward indexed until block ${indexedLatestBlock} for chain ${chainName}`);
        }

        // We forward upto 500 blocks ahead to account for service downtime and restart
        let maxBlockToIndexUntil = Math.min(
            networkLatestBlock,
            indexedLatestBlock + 500
        )

        console.log(`${chainName}: network latest block: ${networkLatestBlock}`);
        console.log(`${chainName}: indexed latest block: ${indexedLatestBlock}`);
        console.log(`${chainName}: indexing until block: ${maxBlockToIndexUntil}`);

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
            indexedLatestBlock,
            maxBlockToIndexUntil
        )
        console.log(`${chainName}: ${filteredEvents.length} latest events retrieved, now processing...`)

        // Process received events
        let startTime = Math.floor(Date.now() / 1000)
        await processEvents(bridgeContract, chainConfig, filteredEvents)
        let endTime = Math.floor(Date.now() / 1000)
        console.log(`Processing took ${endTime - startTime} seconds`)

        // Update the latest block processed for chain
        await redisClient.set(`${chainName}_LATEST_BLOCK_INDEXED`, maxBlockToIndexUntil)
        await redisClient.set(`${chainName}_IS_INDEXING_FORWARD`, "false")

        await redisClient.disconnect()
    } catch (err) {
        console.error(err);
        await redisClient.set(`${chainName}_IS_INDEXING_FORWARD`, "false")
    }
}