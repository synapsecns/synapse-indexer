import {Topics, getEventForTopic, getTopicsHash} from "../config/topics.js";
import {BridgeTransaction} from "../db/transaction.js";
import {BigNumber, ethers} from "ethers";
import {ChainId, Networks, Tokens} from "@synapseprotocol/sdk";
import {getBasePoolAbi, getTokenContract} from "../config/chainConfig.js";
import InputDataDecoder from 'ethereum-input-data-decoder'

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
 * @returns {Object}
 */
function parseTransferLog(logs, chainConfig) {
    // Find log for the Transfer() event
    // Address is token contract address, e.i tokenSent
    let res = {};
    for (let log of logs) {
        if (Object.keys(chainConfig.tokens).includes(log.address)) {
            res.sentTokenAddress = log.address;
            res.sentTokenSymbol = chainConfig.tokens[log.address].symbol;

            let sentValue = log.data;
            if (res.sentTokenSymbol !== "WETH" && chainConfig.id === 1) {
                // Not an ERC-20 token, hence parsing value ?
                try {
                    sentValue = getTokenContract(chainConfig.id, res.sentTokenAddress).interface.parseLog(log).args.value;
                } catch (e) {
                    console.error(e)
                }
            }
            res.sentValue = BigNumber.from(sentValue).toString();

            return res;
        }
    }
    return res;
}

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
 * Pulls out fields from the transaction information
 *
 * @param {Object} txn
 * @returns {Object}
 */
function parseTxn(txn) {
    const fromAddress = txn.from ? txn.from : null;

    return {fromAddress}
}

export async function processEvents(contract, chainConfig, events) {
    for (let event of events) {

        const fromTxnHash = event.transactionHash;
        const txn = await event.getTransaction();
        const block = await event.getBlock();

        const topicHash = event.topics[0];
        const eventInfo = getEventForTopic(topicHash);
        const eventDirection = eventInfo.direction;
        const eventName = eventInfo.eventName;

        console.log(eventInfo)

        const txnReceipt = await event.getTransactionReceipt();
        let eventLogArgs = getEventLogArgs(
            contract.interface,
            txnReceipt.logs,
        );

        if (eventDirection === "OUT") {

            // Process transaction going out of a chain
            let toChainId = eventLogArgs.chainId.toString()
            let toAddress = eventLogArgs.to
            let {fromAddress} = parseTxn(txn)
            let {sentTokenAddress, sentTokenSymbol, sentValue} = parseTransferLog(
                txnReceipt.logs,
                chainConfig
            );
            const fromChainId = chainConfig.id;
            const kappa = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(fromTxnHash)
            );
            console.log("OUT with kappa", kappa)

            const sentTime = block.timestamp;
            const pending = true;

            const transaction = new BridgeTransaction({
                fromTxnHash,
                fromAddress,
                toAddress,
                fromChainId,
                toChainId,
                sentValue,
                sentTokenAddress,
                sentTokenSymbol,
                kappa,
                sentTime,
                pending
            })
            await transaction.save();
        } else {
            let kappa = eventLogArgs.kappa;

            console.log("IN with kappa", kappa)

            let receivedValue = null;
            let receivedToken = "";
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

                // Build out data from event log args
                data = {
                    to: eventLogArgs.to,
                    fee: eventLogArgs.fee,
                    tokenIndexTo: eventLogArgs.swapTokenIndex,
                    swapSuccess: eventLogArgs.swapSuccess,
                    token: eventLogArgs.token
                }

                let receivedToken = null;
                if (data.swapSuccess) {
                    receivedToken = swapPoolAddresses[data.tokenIndexTo]
                } else if (chainConfig.id === ChainId.ETH) {
                    // nUSD (eth) - nexus assets are not in eth pools.
                    receivedToken = '0x1b84765de8b7566e4ceaf4d0fd3c5af52d3dde4f'
                } else {
                    receivedToken = swapPoolAddresses[0];
                }
                swapSuccess = data.swapSuccess;

            } else if (eventName === "TokenWithdraw" || eventName ==="TokenMint") {
                data = {
                    to: eventLogArgs.to,
                    fee: eventLogArgs.fee,
                    token: eventLogArgs.token,
                    amount: eventLogArgs.amount
                }

                receivedToken = data.token;

                if (eventName === "TokenWithdraw") {
                    receivedValue = data.amount - data.fee
                }
            } else {
                console.error("In Event not convered")
            }

            console.log("Data is", data)

            // Avalanche GMX not ERC-20 compatible
            if (chainConfig.id === 43114 && receivedToken === "0x20A9DC684B4d0407EF8C9A302BEAaA18ee15F656") {
                receivedToken = "0x62edc0692BD897D2295872a9FFCac5425011c661";
            }

            if (!receivedValue) {
                let tokenContract = getTokenContract(chainConfig.id, receivedToken)

                /*
                    contract = TOKENS_INFO[chain][received_token.hex()]['_contract'].events

                    for log in receipt['logs']:
                        if log['address'].lower() == received_token.hex():
                            with suppress(MismatchedABI):
                                return contract.Transfer().processLog(log)['args']

                    raise RuntimeError(
                        f'did not converge: {chain}\n{received_token.hex()}\n{receipt}')
                 */
            }

            if (eventName === "TokenMint") {
                /*
                 if received_value != data.amount:  # type: ignore
                received_token, received_value = iterate_receipt_logs(
                    receipt,
                    check_factory(data.amount)  # type: ignore
                )
                 */
            }

            if (!swapSuccess) {
                receivedValue -= data.fee;
            }
        }
    }

}