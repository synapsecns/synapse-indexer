import dotenv  from "dotenv"
dotenv.config({path:'../.env'})
import {getW3Provider} from "../config/chainConfig.js";
import {ChainId} from "@synapseprotocol/sdk";

let provider = await getW3Provider(ChainId.OPTIMISM)
console.log(await provider.detectNetwork())