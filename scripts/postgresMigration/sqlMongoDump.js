import {ethers} from "ethers";
// Setup postgres
import pg from 'pg';
const Client = pg.Client;
const Pool = pg.Pool
import Cursor from 'pg-cursor'

const pool = new Pool(new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'mysecretpassword',
    port: 5432,
}))
const postgresClient = await pool.connect();
const cursor = postgresClient.query(new Cursor(`
    SELECT
    encode(from_tx_hash::bytea, 'hex') as from_tx_hash,
    encode(to_tx_hash::bytea, 'hex') as to_tx_hash,
    encode(from_address::bytea, 'hex') as from_address,
    encode(to_address::bytea, 'hex') as to_address,
    encode(sent_token::bytea, 'hex') as sent_token,
    encode(received_token::bytea, 'hex') as received_token,
    encode(kappa::bytea, 'hex') as kappa,
    from_chain_id,
    to_chain_id,
    sent_value,
    received_value,
    sent_time,
    received_time,
    pending,
    swap_success
    
    FROM txs
    ;
`))

// Setup mongo
import {BridgeTransaction} from "../../db/transaction.js";
import mongoose from "mongoose";
let db = await mongoose.connect('mongodb://localhost:27017/synapseIndexer')

let rows;
let cnt = 0
while ((rows = await cursor.read(10000)).length > 0) {
    for (let row of rows) {

        let fromAddress = '0x'+row.from_address;
        if (ethers.utils.isAddress(fromAddress)) {
            fromAddress = ethers.utils.getAddress(fromAddress);
        }

        let toAddress = '0x'+row.to_address;
        if (ethers.utils.isAddress(toAddress)) {
            toAddress = ethers.utils.getAddress(toAddress);
        }

        let sentTokenAddress = '0x'+row.sent_token;
        if (ethers.utils.isAddress(sentTokenAddress)) {
            sentTokenAddress = ethers.utils.getAddress(sentTokenAddress);
        }

        let receivedTokenAddress = '0x'+row.received_token;
        if (ethers.utils.isAddress(receivedTokenAddress)) {
            receivedTokenAddress = ethers.utils.getAddress(receivedTokenAddress);
        }

        let txn = new BridgeTransaction(
            {
                fromAddress: fromAddress,
                toAddress: toAddress,
                sentTokenAddress: sentTokenAddress,
                receivedTokenAddress: receivedTokenAddress,
                fromTxnHash: row.from_tx_hash ? '0x' + row.from_tx_hash.trim() : row.from_tx_hash,
                toTxnHash: row.to_tx_hash ? '0x' + row.to_tx_hash.trim() : row.to_tx_hash,
                kappa: row.kappa ? '0x' + row.kappa.trim() : row.kappa,
                sentValue: row.sent_value,
                receivedValue: row.received_value,
                fromChainId: row.from_chain_id,
                toChainId: row.to_chain_id,
                sentTime: row.sent_time,
                receivedTime: row.received_time,
                pending: row.pending,
                swapSuccess: row.swap_success,
            }
        );
        await txn.save();
    }

    // Garbage collection cleanup
    delete db.models['BridgeTransaction'];
    delete mongoose.connection.collections['bridgetransactions'];
    await mongoose.deleteModel(/.+/);

    cnt += 10000;
    console.log(`${cnt} records inserted!`)
}

console.log('Complete!')