// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import {BridgeTransaction} from "../db/transaction.js";

import mongoose from "mongoose";
import {buildBridgeContract, ChainConfig, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";
import {ChainId} from "@synapseprotocol/sdk";
import {BigNumber, ethers} from "ethers";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "../indexer/processEvents.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));


// Chain config for Arbitrum
let chainConfig = ChainConfig[ChainId.ARBITRUM]
let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
let w3Provider = getW3Provider(chainConfig.id);
let bridgeContract = buildBridgeContract(
    bridgeContractAddress,
    getBridgeContractAbi(),
    w3Provider
)

// Find txns with incorrect amount
let res = await BridgeTransaction.find({
    "sentValue": { "$exists": true },"$expr": { "$gt": [ { "$strLenCP":"$sentValue" }, 40]}
})

let cnt = 0
let couldNotParse = []

for (let txn of res) {

    // Get block number
    let txnHash = txn.fromTxnHash
    const txnInfo = await w3Provider.send("eth_getTransactionByHash", [
        txnHash,
    ]);

    let blockIndex
    try {
        blockIndex = Number(txnInfo.blockNumber)
    } catch (err) {
        couldNotParse.push(txnInfo.fromTxnHash)
        console.error(`Could not parse txn with hash ${txnHash}`)
        continue
    }

    // Get events for block
    let events = await bridgeContract.queryFilter(
        {
            address: bridgeContractAddress,
            topics: [
                getTopicsHash()
            ]
        },
        blockIndex,
        blockIndex
    )

    // Process the block
    await processEvents(bridgeContract, chainConfig, events)
    cnt += 1
    console.log(`${cnt} done`)
}

console.log(`Finished!`)
console.log(`Could not parse: ${couldNotParse}`)