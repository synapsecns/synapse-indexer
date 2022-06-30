import dotenv  from "dotenv"
dotenv.config({path:'../../.env'})

import {getMissingUSDCnt, addMissingUSDPrice} from "../../scripts/addUSDValue.js";

while (true) {
    await getMissingUSDCnt()
    await addMissingUSDPrice()
    // break
    await new Promise(r => setTimeout(r, 2000));
}