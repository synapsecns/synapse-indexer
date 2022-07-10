import dotenv  from "dotenv"
dotenv.config({path: '../.env.sample'})
import mongoose from "mongoose";
import {BridgeTransaction} from "../db/transaction.js";

import chai from "chai"
import {RedisConnection} from "../db/redis.js";
import {buildBridgeContract, ChainConfig, getBridgeContractAbi, getW3Provider} from "../config/chainConfig.js";
import {ChainId} from "@synapseprotocol/sdk";
import {ethers} from "ethers";
import {getTopicsHash} from "../config/topics.js";
import {processEvents} from "../indexer/processEvents.js";

const expect = chai.expect;
const should = chai.should();

// List of bridge txns with their chain ids, network blocks and expected result
let txnList = [
    {
        fromChainId: ChainId.ETH,
        fromChainBlock: 15100038,
        toChainId: ChainId.BSC,
        toChainBlock: 19362341,
        expectedRes: {"fromTxnHash":"0xa7747d4118d0ed2f58e92de4816c65acff6779f8ead8b025fb4f4abe6bad0b98","toAddress":"0x72f4b3d05E55A37577e3bDA70726E2d4811E693A","fromAddress":"0x72f4b3d05E55A37577e3bDA70726E2d4811E693A","sentValue":"235951606","sentValueFormatted":235.951606,"fromChainId":1,"toChainId":56,"fromChainBlock":15100038,"sentTime":1657258070,"sentTokenSymbol":"USDC","sentTokenAddress":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","kappa":"0xf80201d176023493bcc87eb84d094fa3eeaf3edd1f48a8c5414dbc8f2632d965","pending":false,"__v":0,"receivedTime":1657258174,"receivedTokenAddress":"0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d","receivedTokenSymbol":"USDC","receivedValue":"234012941103098095551","receivedValueFormatted":234.012941103098,"swapSuccess":true,"toChainBlock":19362341,"toTxnHash":"0xcd866f35ae1679a5afb413dc2bef1afa59450cd696aed9f253bf0672826d8088"}
    },
    {
        fromChainId: ChainId.DFK,
        fromChainBlock: 4257814,
        toChainId: ChainId.AVALANCHE,
        toChainBlock: 17040278,
        expectedRes: {"toTxnHash":"0xe09bdc045f575b94054ed1d5e3de776415e6d3569a685a57654162a154393c05","toAddress":"0xE71aF80FDe47c8c78f327354E4D25081058EC727","receivedValue":"222602920725739114825","receivedValueFormatted":222.602920725739,"toChainId":43114,"toChainBlock":17040278,"receivedTime":1657246937,"receivedTokenSymbol":"wAVAX","receivedTokenAddress":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7","kappa":"0x3b8679bb84ff181b9cf75940c2b810be51d139b98adfeb386894e1bad658cb20","pending":false,"__v":0,"fromAddress":"0xE71aF80FDe47c8c78f327354E4D25081058EC727","fromChainBlock":4257814,"fromChainId":53935,"fromTxnHash":"0x43208f684489b6b1805e7c51fc60cc1c087b62555c9486499ecb837e792daec4","sentTime":1657246927,"sentTokenAddress":"0xB57B60DeBDB0b8172bb6316a9164bd3C695F133a","sentTokenSymbol":"wAVAX","sentValue":"222691997524749014430","sentValueFormatted":222.691997524749}
    },
    {
        fromChainId: ChainId.ARBITRUM,
        fromChainBlock: 17229003 ,
        toChainId: ChainId.OPTIMISM,
        toChainBlock: 14062015,
        expectedRes: {"fromTxnHash":"0x87ba82a105088172b03a4c51dfe7fc77c3a0d028ac46361f62545892ade6b7b9","toAddress":"0xf51e5a0A85d29AA0508894405D734BcF044dcb5b","fromAddress":"0xf51e5a0A85d29AA0508894405D734BcF044dcb5b","sentValue":"100000000000000000","sentValueFormatted":0.1,"fromChainId":42161,"toChainId":10,"fromChainBlock":17229003,"sentTime":1657253121,"sentTokenSymbol":"WETH","sentTokenAddress":"0x82aF49447D8a07e3bd95BD0d56f35241523fBab1","kappa":"0xbad4436b75bd5e4bc801e5eadaefab23d251e469ffc8b6f0eee5bf264697a846","pending":false,"__v":0,"receivedTime":1657253251,"receivedTokenAddress":"0x121ab82b49B2BC4c7901CA46B8277962b4350204","receivedTokenSymbol":"WETH","receivedValue":"96973053038470143","receivedValueFormatted":0.0969730530384701,"swapSuccess":true,"toChainBlock":14062015,"toTxnHash":"0x8134a3b9a55d5614b062030ea4901e39df11ca1640abe3bf8041d8256e8b1e73"}
    }
]

async function processEventForChainBlock(chainId, chainBlock) {
    let chainConfig = ChainConfig[chainId]
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
        chainBlock,
        chainBlock
    )
    await processEvents(bridgeContract, chainConfig, events)
}

describe('Process events test', () => {
    before(async function(){
        await mongoose.connect(process.env.TEST_MONGO_URI).catch((err) => console.error(err));
        await mongoose.connection.db.dropDatabase();

        let redisClient = await RedisConnection.getClient(process.env.TEST_REDIS_URI)
        await redisClient.flushall();
    });

    after(async function(){
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close()

        let redisClient = await RedisConnection.getClient()
        await redisClient.flushall()
        await redisClient.disconnect()
    });

    txnList.forEach(async function(txn) {
        it('should process indexing bridge transaction', async () => {
            await processEventForChainBlock(txn.fromChainId, txn.fromChainBlock)
            await processEventForChainBlock(txn.toChainId, txn.toChainBlock)

            let kappa = txn.expectedRes.kappa
            let indexedTxn = await BridgeTransaction.findOne({kappa: kappa})
            let expectedRes = txn.expectedRes

            indexedTxn.fromChainBlock.should.equal(txn.fromChainBlock);
            indexedTxn.toChainBlock.should.equal(txn.toChainBlock);
            indexedTxn.fromChainId.should.equal(txn.fromChainId);
            indexedTxn.toChainId.should.equal(txn.toChainId);

            indexedTxn.kappa.should.equal(expectedRes.kappa);

            indexedTxn.fromTxnHash.should.equal(expectedRes.fromTxnHash);
            indexedTxn.toTxnHash.should.equal(expectedRes.toTxnHash);

            indexedTxn.toAddress.should.equal(expectedRes.toAddress);
            indexedTxn.fromAddress.should.equal(expectedRes.fromAddress);

            indexedTxn.sentValue.should.equal(expectedRes.sentValue);
            indexedTxn.receivedValue.should.equal(expectedRes.receivedValue);

            indexedTxn.sentValueFormatted.should.be.approximately(expectedRes.sentValueFormatted, 0.00001);
            indexedTxn.receivedValueFormatted.should.be.approximately(expectedRes.receivedValueFormatted, 0.00001);

            // Realistically below millions
            expect (indexedTxn.sentValueFormatted.toFixed()).to.have.length.below(8);
            expect (indexedTxn.receivedValueFormatted.toFixed()).to.have.length.below(8);

            indexedTxn.sentTime.should.equal(expectedRes.sentTime);
            indexedTxn.receivedTime.should.equal(expectedRes.receivedTime);

            indexedTxn.sentTokenAddress.should.equal(expectedRes.sentTokenAddress);
            indexedTxn.receivedTokenAddress.should.equal(expectedRes.receivedTokenAddress);

            indexedTxn.pending.should.be.false;
        }).timeout(50000);
    });

});
