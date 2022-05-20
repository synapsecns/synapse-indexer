import dotenv  from "dotenv"
dotenv.config({path:'../../.env'})

// Setup postgres
import pg from 'pg';
import {ChainConfig, getW3Provider} from "../../config/chainConfig.js";
const Client = pg.Client;
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'mysecretpassword',
    port: 5432,
});

client.connect();
// let desiredTimestamp = 1652572800;


// Get latest sent times
for (let key of Object.keys(ChainConfig)) {
    let chainId = ChainConfig[key].id;

    client.query(`
        SELECT
        sent_time
        FROM txs
        where from_chain_id=${chainId}
        order by sent_time DESC limit 1;
`).then(async (res) => {
        console.log(`chainId: ${chainId}`, res.rows);
    });

}

