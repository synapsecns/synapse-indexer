// Get count first
import {BridgeTransaction} from "../db/transaction.js";
import dotenv  from "dotenv"
dotenv.config({path:'../.env'})

import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));


let res = await BridgeTransaction.count({
        "sentValue": { "$ne": null },"$expr": { "$gt": [ { "$strLenCP":"$sentValue" }, 40]}
    })
console.log(`Incorrect sent values - ${res}`)


let res2 = await BridgeTransaction.count({
        "receivedValue": { "$ne": null }, "$expr": { "$gt": [ { "$strLenCP":"$receivedValue" }, 40]}
    })
console.log(`Incorrect received values - ${res2}`)

process.exit(0)