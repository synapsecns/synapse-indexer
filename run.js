import dotenv  from "dotenv"
dotenv.config()

import log from 'loglevel';
import prefix from "loglevel-plugin-prefix";
prefix.reg(log);
log.enableAll();

import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI).catch((err) => log.error(err));
log.debug('Connected to MongoDB!')

import {RedisConnection} from "./db/redis.js";
let redisClient = await RedisConnection.getClient();

import {indexForward} from "./indexer/indexForward.js";
import {indexBackward} from "./indexer/indexBackward.js";
import {ChainConfig} from "./config/chainConfig.js";

let forwardIndexingInterval = 1500; // ideally 15 seconds
let backwardIndexingInterval = 1500; // 3.33 minutes

// Schedule indexing for all chains inside ChainConfig
for (let key of Object.keys(ChainConfig)) {
    // Reset indexing status
    await redisClient.set(`${ChainConfig[key].name}_IS_INDEXING_FORWARD`, "false")
    await redisClient.set(`${ChainConfig[key].name}_IS_INDEXING_BACKWARD`, "false")

    setInterval(indexForward, forwardIndexingInterval, ChainConfig[key])
    setInterval(indexBackward, backwardIndexingInterval, ChainConfig[key])
}
await redisClient.disconnect()
