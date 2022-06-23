// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import {BridgeTransaction} from "../db/transaction.js";

import mongoose from "mongoose";
import {getW3Provider} from "../config/chainConfig.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

let cnt = 0

for await (const txn of BridgeTransaction.find({}).cursor()) {
    let fromChainBlock = null
    let toChainBlock = null

    if (txn.fromTxnHash && txn.fromChainId) {
        let provider = getW3Provider(txn.fromChainId)
        await provider.detectNetwork()
        const txnInfo = await provider.send("eth_getTransactionByHash", [
            txn.fromTxnHash,
        ]);

        let blockNum = txnInfo.blockNumber
        const block = Number(blockNum)
        fromChainBlock = block
    }

    if (txn.toTxnHash && txn.toChainId) {
        let provider = getW3Provider(txn.toChainId)
        await provider.detectNetwork()
        const txnInfo = await provider.send("eth_getTransactionByHash", [
            txn.toTxnHash,
        ]);

        let blockNum = txnInfo.blockNumber
        const block = Number(blockNum)
        toChainBlock = block
    }

    let args = {}
    if (toChainBlock) {
        args['toChainBlock'] = toChainBlock
    }
    if (fromChainBlock) {
        args['fromChainBlock'] = fromChainBlock
    }
    let kappa = txn.kappa

    let res = await BridgeTransaction.findOneAndUpdate(
        {"kappa":kappa},
        args,
        {new: true}
    );

    cnt += 1;
    console.log(`${cnt} - ${res.kappa}`)
}

console.log("Finished!")