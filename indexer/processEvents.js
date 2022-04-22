import {Topics, getEventForTopic, getTopicsHash} from "../config/topics.js";
import {BridgeTransaction} from "../db/transaction.js";
import {BigNumber, ethers} from "ethers";
import {Networks, Tokens} from "@synapseprotocol/sdk";

/**
 * Receives array of logs and returns information pulled from the actual Event log
 * The event could be TokenDepositAndSwap, TokenDeposit, etc.
 *
 * @param {Object} contractInterface
 * @param {Array<Object>} logs
 * @returns {Object}
 */
function parseEventLog(contractInterface, logs) {
    let data = {};
    for (let topicHash of getTopicsHash()) {
        for (let log of logs) {
            if (log.topics.includes(topicHash)) {
                let logArgs = contractInterface.parseLog(log).args;
                data.toChainId = logArgs.chainId.toString()
                data.toAddress = logArgs.to
                return data;
            }
        }
    }
    return data;
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
            res.sentValue = BigNumber.from(log.data).toString();
            return res;
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
        const direction = eventInfo.direction;

        const txnReceipt = await event.getTransactionReceipt();

        if (direction === "OUT") {

            // Process transaction going out of a chain
            let {fromAddress} = parseTxn(txn)
            let {toChainId, toAddress} = parseEventLog(
                contract.interface,
                txnReceipt.logs,
            );
            let {sentTokenAddress, sentTokenSymbol, sentValue} = parseTransferLog(
                txnReceipt.logs,
                chainConfig
            );
            const fromChainId = chainConfig.id;
            const kappa = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(fromTxnHash)
            );
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
            console.log("IN found...")
        }
    }

}