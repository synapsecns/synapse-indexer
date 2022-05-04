import {indexForward} from "./indexer/indexForward.js";
import {indexBackwards} from "./indexer/indexBackwards.js";
import {ChainConfig} from "./config/chainConfig.js";
import mongoose from "mongoose";
import dotenv  from "dotenv"
dotenv.config()

await mongoose.connect(process.env.MONGO_URI).catch((err) => console.log(err));
console.log('Connected to MongoDB!')

// Indexes latest events
async function indexChainsForward() {
    Object.keys(ChainConfig).forEach(chainId => {
        indexForward(ChainConfig[chainId]);
    })
}

// Backfill previous events
async function indexChainsBackwards() {
    Object.keys(ChainConfig).forEach(chainId => {
        indexBackwards(ChainConfig[chainId]);
    })
}

let forwardIndexingInterval = 20000; // 20 seconds
setInterval(indexChainsForward, forwardIndexingInterval)

let backwardIndexingInterval = 200000; // About 3.33 minutes
setInterval(indexChainsBackwards, backwardIndexingInterval)
