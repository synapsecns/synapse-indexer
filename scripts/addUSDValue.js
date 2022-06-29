// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import {BridgeTransaction} from "../db/transaction.js";

import mongoose from "mongoose";
import {getIndexerLogger} from "../utils/loggerUtils.js";
import {calculateFormattedUSDPrice} from "../indexer/processEvents.js";
import {getISODateFromEpoch} from "../utils/timeUtils.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

let cnt = 0
let logger = getIndexerLogger(`addUSDValue`);
let errorTokens = new Set()

export async function appendPricesForDate(args, logger, sentTime, receivedTime) {
    try {
        if (args.sentValue && args.fromChainId && args.sentTokenAddress) {
            let sentDate = getISODateFromEpoch(sentTime)
            let prices = await calculateFormattedUSDPrice(args.sentValue, args.fromChainId, args.sentTokenAddress.toLowerCase(), sentDate)
            args.sentValueFormatted = prices.valueFormatted
            args.sentValueUSD = prices.valueUSD
        }
    } catch (err) {
        logger.error(`Unable to parse formatted values for txn with from txn hash ${args.fromTxnHash} - ${err.toString()}`)
        errorTokens.add(args.sentTokenAddress)
    }

    try {
        if (args.receivedValue && args.toChainId && args.receivedTokenAddress) {
            let receivedDate = getISODateFromEpoch(receivedTime)
            let prices = await calculateFormattedUSDPrice(args.receivedValue, args.toChainId, args.receivedTokenAddress.toLowerCase(), receivedDate)
            args.receivedValueFormatted = prices.valueFormatted
            args.receivedValueUSD = prices.valueUSD
        }
    } catch (err) {
        logger.error(`Unable to parse formatted values for txn with to txn hash ${args.toTxnHash} - ${err.toString()}`)
        errorTokens.add(args.receivedTokenAddress)
    }
}

// Get count
console.log(await BridgeTransaction.count({sentValueUSD: {$exists: false}}))

for await (const txn of BridgeTransaction.find({sentValueUSD: {$exists: false}}).cursor()) {
    try {
        let args = txn
        await appendPricesForDate(args, logger, args.sentTime, args.receivedTime)
        let res = await BridgeTransaction.findOneAndUpdate(
            {"kappa":args.kappa},
            args,
            {new: true}
        );
        cnt += 1
        logger.info(`${cnt} - ${res.kappa}`)
    } catch (err) {
        logger.error(err)
    }
}

console.log("Finished!")
console.log(`Could not find for tokens`)
console.log(errorTokens)