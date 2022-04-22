import {ethers} from "ethers";
import {RedisConnection} from "../db/redis.js";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";

export async function indexForward(chainConfig) {
    let chainName = chainConfig.name;
    let w3Provider = ethers.getDefaultProvider(chainConfig.rpc);
    let redisClient = await RedisConnection.getClient();

    let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);

    console.log(`${chainName}: Indexing forward for network`)

    // Get block intervals to get events between
    let networkLatestBlock = await w3Provider.getBlockNumber();
    let indexedLatestBlock = await redisClient.get(
        `${chainName}_LATEST_BLOCK_INDEXED`
    )
    indexedLatestBlock = (indexedLatestBlock) ? parseInt(indexedLatestBlock) : networkLatestBlock;

    console.log(`${chainName}: network latest block: ${networkLatestBlock}`);
    console.log(`${chainName}: indexed latest block: ${indexedLatestBlock}`);

    // Init contract
    // TODO: Init in config
    let contract = new ethers.Contract(
        bridgeContractAddress,
        chainConfig.abi,
        w3Provider
    )

    //
    let maxBlockToIndexUntil = Math.min(
        indexedLatestBlock,
        networkLatestBlock + 500
    )
    console.log(`${chainName}: attempting to index until block: ${maxBlockToIndexUntil}`);

    // Get events between these blocks
    let filteredEvents = await contract.queryFilter(
        {
            address: bridgeContractAddress,
            topics: [
                getTopicsHash()
            ]
        },
        indexedLatestBlock-500,
        maxBlockToIndexUntil
    )
    console.log(`${chainName}: ${filteredEvents.length} latest events retrieved, now processing...`)

    // Process received events
    processEvents(contract, chainConfig, filteredEvents)

    // Update the latest block processed for chain
    await redisClient.set(`${chainName}_LATEST_BLOCK_INDEXED`, maxBlockToIndexUntil)
    await redisClient.disconnect()
}