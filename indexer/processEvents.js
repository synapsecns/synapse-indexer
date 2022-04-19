import {Topics, getEventForTopic} from "../config/topics.js";
import {ethers} from "ethers";
import {getSynapseBridgeABI} from "../abis/abi.js";
/*
 {
    blockNumber: 14604143,
    blockHash: '0xb844b04399748b8120b24bb7749ac1f2bd9df8bffe3f61fe71a6bfb8c3282577',
    transactionIndex: 157,
    removed: false,
    address: '0x2796317b0fF8538F253012862c06787Adfb8cEb6',
    data: '0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000330ef0ae97769fc000000000000000000000000000000000000000000000000002386f26fc10000',
    topics: [
      '0x8b0afdc777af6946e53045a4a75212769075d30455a212ac51c9b16f9c5c9b26',
      '0x00000000000000000000000023f6dcd76494a65f12d7871dd4138a6f2ccb3579',
      '0x42248011d3e2d47f0b2badfb7a2f5ff98882ae41eac69c1289b29ee05e3cdc72'
    ],
    transactionHash: '0x8b05d3682e5a1bfc4a3e2b7752f38d94ef6a78b59d8618049269f9e4d315e432',
    logIndex: 275,
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
 */
export function processEvents(contract, chainConfig, events) {
    events.forEach(async (event) => {

        // const txnHash = event.transactionHash;
        // const txnInfo = await event.getTransaction();
        // const topicHash = event.topics[0];
        //
        // const eventInfo = getEventForTopic(topicHash);
        // const eventName = eventInfo.eventName;
        // const direction = eventInfo.direction;

        const txnReceipt = await event.getTransactionReceipt();
        let log = contract.interface.parseLog(txnReceipt.logs[1]);
        console.log(log)

        // console.log(donor, value, tokenID)


        process.exit(0)

    })
}