import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI).catch((err) => console.error(err));
import {ethers} from "ethers";
import {buildBridgeContract, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";
import {ChainConfig} from "../config/chainConfig.js";
import {ChainId} from "@synapseprotocol/sdk";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "../indexer/processEvents.js";


let blockIndex = 8939815

let chainConfig = ChainConfig[ChainId.ARBITRUM]
let bridgeContractAddress = ethers.utils.getAddress(chainConfig.bridge);
let w3Provider = getW3Provider(chainConfig.id);

let bridgeContract = buildBridgeContract(
    bridgeContractAddress,
    getBridgeContractAbi(),
    w3Provider
)
let events = await bridgeContract.queryFilter(
    {
        address: bridgeContractAddress,
        topics: [
            getTopicsHash()
        ]
    },
    blockIndex,
    blockIndex
)

await processEvents(bridgeContract, chainConfig, events)