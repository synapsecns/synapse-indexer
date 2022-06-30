// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import { MongoClient } from "mongodb";

let client = await MongoClient.connect(
    process.env.MONGO_URI
);

const database = client.db();
const bridgeTransactions = database.collection("bridgetransactions");

let res = await bridgeTransactions.aggregate([
    {$group: {
            _id: {kappa: "$kappa"},
            uniqueIds: {$addToSet: "$_id"},
            count: {$sum: 1}
        }
    },
    {$match: {
            count: {"$gt": 1}
        }
    }
], {allowDiskUse:true});

let cnt = 0
for await (const txn of res) {
    cnt += 1
    console.log(txn._id.kappa)
    for (let id of txn.uniqueIds.slice(1)) {
        await bridgeTransactions.deleteOne({"_id" : id})
    }
    // console.log((await bridgeTransactions.find({kappa : txn._id.kappa}).toArray()).length)
}

console.log(`${cnt} deleted!`)