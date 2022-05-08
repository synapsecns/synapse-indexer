import dotenv  from "dotenv"
dotenv.config()

import log from 'loglevel';
import prefix from "loglevel-plugin-prefix";
prefix.reg(log);
log.enableAll();

import {indexForward} from "./indexer/indexForward.js";
import {indexBackward} from "./indexer/indexBackward.js";
import {ChainConfig} from "./config/chainConfig.js";
import mongoose from "mongoose";


await mongoose.connect(process.env.MONGO_URI).catch((err) => log.error(err));
log.debug('Connected to MongoDB!')

let forwardIndexingInterval = 15000; // ideally 15 seconds
let backwardIndexingInterval = 15000; // 3.33 minutes

// Schedule indexing for all chains inside ChainConfig
for (let key of Object.keys(ChainConfig)) {
    setInterval(indexForward, forwardIndexingInterval, ChainConfig[key])
    setInterval(indexBackward, backwardIndexingInterval, ChainConfig[key])
}
