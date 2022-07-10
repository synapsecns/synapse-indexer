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
        fromChainId: ChainId.FANTOM,
        fromChainBlock: 41149116 ,
        toChainId: ChainId.POLYGON,
        toChainBlock: 29904168,
        expectedRes: {"fromTxnHash":"0x282d41ac201664c7419eedf58a36a990adbc81242eb0c12f8af473aee6e8f1fd","toAddress":"0xC6D922d34b354F949EF992eeFacE2F6F7a06fB29","fromAddress":"0x935b702Da05d8701AF3a6101166c7895ff5b3741","sentValue":"998882534","sentValueFormatted":998.882534,"sentValueUSD":998.552184986889,"fromChainId":250,"toChainId":137,"sentTime":1655982521,"sentTokenSymbol":"USDC","sentTokenAddress":"0x04068DA6C83AFCFA0e13ba15A6696662335D5B75","kappa":"0xfc2c4d7d2d8b7674daede0446f479a33c1ff07aad911ac36cd51c863dbb41219","pending":false,"__v":0,"receivedTime":1655982563,"receivedTokenAddress":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","receivedTokenSymbol":"USDC","receivedValue":"997959253","receivedValueFormatted":997.959253,"receivedValueUSD":997.62920933307,"swapSuccess":true,"toTxnHash":"0x0c21f80c373139ea1157baf3fce32b33f8c764814b8915a9931a7eb872a85527","fromChainBlock":41149116,"toChainBlock":29904168}
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
