// This script fixes amounts incorrectly picked up by Approve instead of transfer events

import dotenv  from "dotenv"
dotenv.config({path:'../.env'})

import {BridgeTransaction} from "../db/transaction.js";
import {getAndCacheTokenUSDPrice} from "../workers/usdValueWorker/cacheTokenUSDPrice.js"
import mongoose from "mongoose";
import {getIndexerLogger} from "../utils/loggerUtils.js";
import {calculateFormattedUSDPrice} from "../indexer/processEvents.js";
import {getISODateFromEpoch} from "../utils/timeUtils.js";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));

let cnt = 0
let logger = getIndexerLogger(`addUSDValue`);
let errorTokens = new Set()
let errorTxns = new Set()

export async function appendPricesForDate(args, logger, sentTime, receivedTime) {
    try {
        if (args.sentValue && args.fromChainId && args.sentTokenAddress) {
            let sentDate = getISODateFromEpoch(sentTime)
            let prices = await calculateFormattedUSDPrice(args.sentValue, args.fromChainId, args.sentTokenAddress.toLowerCase(), sentDate)
            args.sentValueFormatted = prices.valueFormatted

            // Try again
            if (!prices.valueUSD) {
                await getAndCacheTokenUSDPrice(args.fromChainId, args.sentTokenAddress, sentDate)
                prices = await calculateFormattedUSDPrice(args.sentValue, args.fromChainId, args.sentTokenAddress.toLowerCase(), sentDate)
            }
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

            // Try again
            if (!prices.valueUSD) {
                await getAndCacheTokenUSDPrice(args.toChainId, args.receivedTokenAddress, receivedDate)
                prices = await calculateFormattedUSDPrice(args.receivedValue, args.toChainId, args.receivedTokenAddress.toLowerCase(), receivedDate)
            }

            args.receivedValueUSD = prices.valueUSD

        }
    } catch (err) {
        logger.error(`Unable to parse formatted values for txn with to txn hash ${args.toTxnHash} - ${err.toString()}`)
        errorTokens.add(args.receivedTokenAddress)
    }
}

// Get count
export async function getMissingUSDCnt() {
    console.log(await BridgeTransaction.count({sentValueUSD: {$exists: false}}))
}

export async function addMissingUSDPrice() {
    console.log("Attempting to add missing USD Prices for tokens")
    for await (const txn of BridgeTransaction.find({
        $or : [
            {sentValueUSD: {$exists: false}}, {receivedValueUSD: {$exists: false}}
        ],
        sentValue: {$exists: true},
        receivedValue: {$exists: true}
    })
        .sort({sentTime: -1})
        // .limit(1)
        .cursor()) {
        try {
            let args = txn

            await appendPricesForDate(args, logger, args.sentTime, args.receivedTime)
            let res = await BridgeTransaction.findOneAndUpdate(
                {"_id": args._id}, args
            );
            cnt += 1
            logger.info(`successfully updated ${cnt} - ${res.kappa}`)
        } catch (err) {
            logger.error(`Error ! ${err} - ${res.kappa}`)
            errorTxns.add(res.kappa)
        }
    }
    console.log("Finished!")
    console.log(`Could not find for tokens`)
    console.log(errorTokens)
    console.log(`Could not find for txns`)
    console.log(errorTxns)

}
