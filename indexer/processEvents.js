import {getEventForTopic, getTopicsHash} from "../config/topics.js";
import {BridgeTransaction} from "../db/transaction.js";
import {BigNumber, ethers} from "ethers";
import {ChainId} from "@synapseprotocol/sdk";
import {getBasePoolAbi, getTokenContract} from "../config/chainConfig.js";
import {getIndexerLogger} from "../utils/loggerUtils.js";

/**
 * Get name of contract function that emits the event
 * https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol
 *
 * @param eventName
 * @return {string|null}
 */
function getFunctionForEvent(eventName) {
    switch (eventName) {
        case "TokenWithdrawAndRemove":
            return "withdrawAndRemove"
        case "TokenMintAndSwap":
            return "mintAndSwap"
    }
    return null;
}

/**
 * Removes keys in object with undefined values
 *
 * @param obj
 */
function removeUndefinedValuesFromArgs(obj) {
    let keysToRemove = []
    for (let key of Object.keys(obj)) {
        if (!obj[key]) {
            keysToRemove.push(key);
        }
    }

    for (let key of keysToRemove) {
        delete obj[key];
    }
}

/**
 * Receives array of logs and returns a dict with their args
 *
 * @param {Object} contractInterface
 * @param {Array<Object>} logs
 * @returns {Object}
 */
function getEventLogArgs(contractInterface, logs) {
    for (let topicHash of getTopicsHash()) {
        for (let log of logs) {
            if (log.topics.includes(topicHash)) {
                return contractInterface.parseLog(log).args;
            }
        }
    }
    return {};
}

/**
 * Receives array of logs and returns information pulled from the Transfer log
 *
 * @param {Array<Object>} logs
 * @param {Object} chainConfig
 * @param {Object} logger
 * @returns {Object}
 */
function parseTransferLog(logs, chainConfig, logger) {
    // Find log for the Transfer() event
    // Address is token contract address, e.i tokenSent

    let res = {};
    for (let log of logs) {
        if (Object.keys(chainConfig.tokens).includes(log.address)) {
            res.sentTokenAddress = log.address;
            res.sentTokenSymbol = chainConfig.tokens[log.address].symbol;

            let sentValue = log.data;

            // Non native token transfers on Ethereum
            if (res.sentTokenSymbol !== "WETH" && chainConfig.id === ChainId.ETH) {
                try {
                    sentValue = getTokenContract(chainConfig.id, res.sentTokenAddress).interface.parseLog(log).args.value;
                } catch (e) {
                    logger.error('Error for non native token on Ethereum', e)
                }
            }
            res.sentValue = BigNumber.from(sentValue).toString();

            return res;
        }
    }
    return res;
}

/**
 * Returns list of token addresses for coins that form the stableswap pool for a chain
 *
 * @param poolAddress
 * @param chainConfig
 * @param contract
 * @param chainId
 * @return {Promise<*[]>}
 */
async function getSwapPoolCoinAddresses(poolAddress, chainConfig, contract, chainId) {
    let poolContract = new ethers.Contract(
        poolAddress,
        getBasePoolAbi(),
        contract.provider
    )

    let res = [];

    for (let i = 0; i < (1 << 8); i++) {
        try {
            let tokenRes = await poolContract.functions.getToken(i);
            res.push(tokenRes[0]);
        } catch (e) {
            break;
        }
    }

    return res;
}

/**
 * Insert IN/OUT Bridge Txn or update it with the IN/OUT counterpart
 * Idempotent for transactions with identical kappa and params
 *
 * @param {String} kappa
 * @param {Object} args
 * @param {Object} logger
 * @return {Promise<Query<any, any, {}, any>|*>}
 */
async function upsertBridgeTxnInDb(kappa, args, logger) {
    removeUndefinedValuesFromArgs(args);
    logger.debug(`values to be inserted in db for txn with kappa ${kappa} are ${JSON.stringify(args)}`)

    let filter = {"kappa": kappa};
    let existingTxn = await BridgeTransaction.findOne(filter);

    // Insert new transaction
    if (!existingTxn) {
        logger.debug(`Transaction with kappa ${kappa} not found. Inserting...`)
        args.pending = true
        return await new BridgeTransaction(
            args
        ).save();
    }

    // Update existing bridge with args with pending check
    if ((existingTxn.fromTxnHash && args.toTxnHash) || (existingTxn.toTxnHash && args.fromTxnHash)) {
        args.pending = false;
    }
    logger.debug(`Transaction with kappa ${kappa} found, pending set to ${args.pending}. Updating...`)
    return await BridgeTransaction.findOneAndUpdate(filter, args, {new: true});
}

export async function processEvents(contract, chainConfig, events) {
    let logger = getIndexerLogger(`processEvents_${chainConfig.name}`);

    logger.debug(`proceeding to process ${events.length} retrieved events`)

    for (let event of events) {

        const txnHash = event.transactionHash;
        const txn = await event.getTransaction();
        const block = await event.getBlock();
        const timestamp = block.timestamp;

        const topicHash = event.topics[0];
        const eventInfo = getEventForTopic(topicHash);
        const eventDirection = eventInfo.direction;
        const eventName = eventInfo.eventName;

        logger.debug(eventInfo)

        const txnReceipt = await event.getTransactionReceipt();
        let eventLogArgs = getEventLogArgs(
            contract.interface,
            txnReceipt.logs,
        );

        if (eventDirection === "OUT") {

            // Process transaction going out of a chain
            let toChainId = eventLogArgs.chainId.toString()
            let toAddress = eventLogArgs.to
            let fromAddress = txn.from;
            let {sentTokenAddress, sentTokenSymbol, sentValue} = parseTransferLog(
                txnReceipt.logs,
                chainConfig,
                logger
            );
            const fromChainId = chainConfig.id;
            const kappa = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(txnHash)
            );
            const pending = true;

            await upsertBridgeTxnInDb(kappa, {
                fromTxnHash: txnHash,
                fromAddress,
                toAddress,
                fromChainId,
                toChainId,
                sentValue,
                sentTokenAddress,
                sentTokenSymbol,
                kappa,
                sentTime: timestamp,
                pending
            }, logger)

            logger.info(`OUT with kappa ${kappa} txnHash ${txnHash} saved`)

        } else {
            let kappa = eventLogArgs.kappa;

            logger.debug(`IN with kappa ${kappa} event ${eventName} txnHash ${txnHash}`)

            let receivedValue = null;
            let receivedToken = null;
            let swapSuccess = null;
            let data = {}

            if (eventName === "TokenWithdrawAndRemove" || eventName ==="TokenMintAndSwap") {
                let input = txn.data
                let inputArgs = contract.interface.decodeFunctionData(getFunctionForEvent(eventName), input)

                // Get list of stable coin addresses
                let swapPoolAddresses = await getSwapPoolCoinAddresses(
                    inputArgs.pool,
                    chainConfig,
                    contract,
                    chainConfig.id
                )
                logger.debug(`Swap pool is ${swapPoolAddresses}`)

                // Build out data from event log args
                data = {
                    to: eventLogArgs.to,
                    fee: eventLogArgs.fee,
                    tokenIndexTo: eventLogArgs.swapTokenIndex,
                    swapSuccess: eventLogArgs.swapSuccess,
                    token: eventLogArgs.token
                }

                // Determine received token
                if (data.swapSuccess) {
                    if (data.tokenIndexTo) {
                        receivedToken = swapPoolAddresses[data.tokenIndexTo]
                    } else if (data.token) {
                        receivedToken = data.token
                    } else {
                        logger.error(`Could not find received token for txn with kappa ${kappa}. Data is ${JSON.stringify(data)}`)
                        continue;
                    }
                } else if (chainConfig.id === ChainId.ETH) {
                    // nUSD (eth) - nexus assets are not in eth pools.
                    receivedToken = '0x1b84765de8b7566e4ceaf4d0fd3c5af52d3dde4f'
                } else {
                    receivedToken = swapPoolAddresses[0];
                }
                swapSuccess = data.swapSuccess;
                logger.debug("Received token is ", receivedToken);

            } else if (eventName === "TokenWithdraw" || eventName ==="TokenMint") {
                data = {
                    to: eventLogArgs.to,
                    fee: eventLogArgs.fee,
                    token: eventLogArgs.token,
                    amount: eventLogArgs.amount
                }

                receivedToken = data.token;

                if (eventName === "TokenWithdraw") {
                    receivedValue = BigNumber.from(data.amount).sub(BigNumber.from(data.fee))
                }
            } else {
                logger.error("In Event not convered")
                continue;
            }

            // Avalanche GMX not ERC-20 compatible
            if (chainConfig.id === 43114 && receivedToken === "0x20A9DC684B4d0407EF8C9A302BEAaA18ee15F656") {
                receivedToken = "0x62edc0692BD897D2295872a9FFCac5425011c661";
            }

            // TODO: Move to searchLogs function
            if (!receivedValue) {
                logger.debug("Searching logs for received value...")
                let tokenContract = getTokenContract(chainConfig.id, receivedToken)
                try {
                    for (let log of txnReceipt.logs) {
                        logger.debug(`Comparing ${log.address} and ${receivedToken}`)
                        if (log.address === receivedToken) {
                            let logArgs = tokenContract.interface.parseLog(log).args
                            logger.debug(`log args after parsing for received value are ${JSON.stringify(logArgs)}`)
                            if (logArgs.value) {
                                receivedValue = BigNumber.from(logArgs.value)
                            } else if (logArgs.amount) {
                                receivedValue = BigNumber.from(logArgs.amount)
                            }
                            logger.debug(`received value parsed is ${receivedValue}`)
                            break;
                        }
                    }
                } catch (err) {
                    logger.error(`${err}`)
                }

                if (!receivedValue) {
                    logger.error(`Error! Unable to find received value for log, txn hash ${txnHash}`)
                    continue;
                }
                logger.debug(`Received value is ${receivedValue}`);
            }

            if (eventName === "TokenMint") {
                if (receivedValue !== data.amount) {
                    logger.debug(`Event is TokenMint, received value is ${receivedValue} and amount is ${data.amount}`)
                    for (let log of txnReceipt.logs) {
                        receivedValue = BigNumber.from(log.data);
                        receivedToken =  log.address;
                        logger.debug(`Received value is ${receivedValue}, data.amount is ${data.amount}`);
                        if (data.amount.gt(receivedValue)) {
                            break;
                        }
                    }
                }
            }

            console.log(`Value here is ${receivedValue}`)
            if (!swapSuccess) {
                BigNumber.from(receivedValue).sub(BigNumber.from(data.fee));
            }
            console.log(`Value after subtraction is ${receivedValue}`)

            await upsertBridgeTxnInDb(kappa, {
                    toTxnHash: txnHash,
                    toAddress: data.to,
                    receivedValue,
                    receivedTokenAddress: receivedToken,
                    receivedTokenSymbol: chainConfig?.tokens[receivedToken]?.symbol,
                    swapSuccess,
                    kappa,
                    receivedTime: timestamp,
                    toChainId: chainConfig.id,
                    pending: false
                },
                logger
            )

            logger.info(`IN with kappa ${kappa} saved`)

        }
    }

}