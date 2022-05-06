import { MongoClient } from "mongodb";

let client = await MongoClient.connect(
    "mongodb://localhost:27017/synapseIndexer"
);

const database = client.db();
const bridgeTransactions = database.collection("bridgetransactions");
let resCreationArr = []

resCreationArr.push(await bridgeTransactions.createIndex({fromChainId: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({toChainId: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({fromAddress: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({toAddress: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({sentTokenSymbol: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({receivedTokenSymbol: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({kappa: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({pending: 1}));
resCreationArr.push(await bridgeTransactions.createIndex({sentTime: -1}));
resCreationArr.push(await bridgeTransactions.createIndex({receivedTime: -1}));

console.log(`Indices created: ${resCreationArr}`);

