import {indexForward} from "./indexer/indexForward.js";
import {indexBackwards} from "./indexer/indexBackwards.js";
import {ChainConfig} from "./config/chainConfig.js";
import mongoose from "mongoose";
import dotenv  from "dotenv"
dotenv.config()

await mongoose.connect(process.env.MONGO_URI).catch((err) => console.log(err));
console.log('Connected to MongoDB!')

let forwardIndexingInterval = 20000; // 20 seconds
let backwardIndexingInterval = 200000; // About 3.33 minutes

// Schedule indexing for all chains inside ChainConfig
for (let key of Object.keys(ChainConfig)) {
    setInterval(indexForward, forwardIndexingInterval, ChainConfig[key])
    setInterval(indexBackwards, backwardIndexingInterval, ChainConfig[key])
}
