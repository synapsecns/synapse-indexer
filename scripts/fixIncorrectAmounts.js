// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import {BridgeTransaction} from "../db/transaction.js";

import mongoose from "mongoose";
import {getW3Provider} from "../config/chainConfig.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

let res = await BridgeTransaction.find({
    "sentValue": { "$exists": true },"$expr": { "$gt": [ { "$strLenCP":"$sentValue" }, 40]}
})
for (let txn of res) {
    // TODO: Complete
    let chainId = txn.fromChainId
    let txnHash = txn.fromTxnHash
    // console.log(chainId, txnHash)
    //
    // let w3Provider = getW3Provider(chainConfig.id);
    // const txInfo = await provider.send("eth_getTransactionByHash", [
    //     "0x04b713fdbbf14d4712df5ccc7bb3dfb102ac28b99872506a363c0dcc0ce4343c",
    // ]);
    // console.log(txInfo);

}