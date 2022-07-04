// Get count first
import {BridgeTransaction} from "../db/transaction.js";
import dotenv  from "dotenv"
dotenv.config({path:'../.env'})

import mongoose from "mongoose";
import {ChainId} from "@synapseprotocol/sdk";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

for await (const txn of BridgeTransaction.find({
    fromChainId: ChainId.FANTOM
})
    .sort({sentValueUSD: -1})
    .limit(10)
    .cursor()
    ) {
    console.log(txn)
}
