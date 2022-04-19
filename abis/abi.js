import { promises as fs } from "fs";

export async function getSynapseBridgeABI() {
    const data = await fs.readFile("./abis/bridge.json", "utf8");
    return JSON.parse(data).abi;
}
