import {ethers} from "ethers";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "./processEvents.js";
import {getIndexerLogger} from "../utils/loggerUtils.js";
import {getEpochSeconds} from "../utils/timeUtils.js";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";


export async function indexOlderTransactions(chainConfig) {
    let logger = getIndexerLogger(`${chainConfig.name}_${indexOlderTransactions.name}`)

    try {
        let w3Provider = getW3Provider(chainConfig.id);

        // Initialize Bridge Contract
        let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
        let bridgeContract = buildBridgeContract(
            bridgeContractAddress,
            getBridgeContractAbi(),
            w3Provider
        )

        // Get the block you wish to index until
        let startBlock = chainConfig.oldestBlock;
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
            logger.debug(`processing from ${b} to ${b + 500} took ${endTime - startTime} seconds`)
        }
    } catch (err) {
        logger.error(err)
    }
}