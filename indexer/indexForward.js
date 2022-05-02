import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {buildBridgeContract, getW3Provider} from "../config/chainConfig.js";

export async function indexForward(chainConfig) {
    let chainName = chainConfig.name;
    let w3Provider = getW3Provider(chainConfig.id, chainConfig.rpc);
    let redisClient = await RedisConnection.getClient();

    console.log(`${chainName}: Indexing forward for network`)

    // Get block intervals to get events between
    let networkLatestBlock = await w3Provider.getBlockNumber();
    let indexedLatestBlock = await redisClient.get(
        `${chainName}_LATEST_BLOCK_INDEXED`
    )
    indexedLatestBlock = (indexedLatestBlock) ? parseInt(indexedLatestBlock) : networkLatestBlock;

    console.log(`${chainName}: network latest block: ${networkLatestBlock}`);
    console.log(`${chainName}: indexed latest block: ${indexedLatestBlock}`);

    // Initialize Bridge Contract
    let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
    let bridgeContract = buildBridgeContract(
        bridgeContractAddress,
        chainConfig.abi,
        w3Provider
    )

    let maxBlockToIndexUntil = Math.min(
        indexedLatestBlock,
        networkLatestBlock + 500
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
    await redisClient.disconnect()
}