import {indexForward} from "./indexer/indexForward.js";
import {ChainConfig} from "./config/chainConfig.js";
import dotenv  from "dotenv"
dotenv.config()

// Fire async processing events for each chain
async function indexChains() {
    Object.keys(ChainConfig).forEach(chainId => {
        indexForward(ChainConfig[chainId]);
    })
}

// Trigger indexing ever `interval` ms
// let interval = 1000;
// setInterval(indexChains, interval)

await indexChains()