// Get count first
import {BridgeTransaction} from "../db/transaction.js";
import dotenv  from "dotenv"
dotenv.config({path:'../.env'})

import mongoose from "mongoose";
import {buildBridgeContract, ChainConfig, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";
import {ethers} from "ethers";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "../indexer/processEvents.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

let cntRes = await BridgeTransaction.count({
    sentValueUSD: {$exists: true, $gt: 10000000}
})
console.log(cntRes);

for await (const txn of BridgeTransaction.find({
    sentValueUSD: {$exists: true, $gt: 10000000}
})
    .cursor()) {
    let blockIndex = txn.fromChainBlock
    let chainConfig = ChainConfig[txn.fromChainId]
    let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
    let w3Provider = getW3Provider(chainConfig.id);
    let prev = txn.sentValueUSD

    let bridgeContract = buildBridgeContract(
        bridgeContractAddress,
        getBridgeContractAbi(),
        w3Provider
    )
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

    await processEvents(bridgeContract, chainConfig, events)

    console.log(txn.kappa, prev)
}
