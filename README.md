# Synapse Indexer

Indexes Bridge Transactions for Synapse across all chains.

### Setup

* `npm i`
* Ensure Redis and MongoDB are running locally, e.g.
    * `docker run -p 27017:27017 mongo`
    * `docker run -p 6379:6379 redis`
* `cp .env.sample .env`
    * RPCs, *MONGO_URI* and *REDIS_URI* should be set appropriately
* `npm start`

### How this works

* Config
  * Events emitted by Synapse Bridge Contracts across all chains (`chainConfig.js`) are tracked for specific events (`topics.js`) that indicate a bridge transaction/swap has taken place. The indexing mechanism is broken up into 2 parts where it indexes forwards and backwards simultaneously.

* Indexing 
  * For indexing backward (`indexBackward.js`), it checks the latest block it has indexed in Redis, say *currBlock* and attempts to index *currBlock - N* blocks, until the start block specified for that chain in it's config. 
  * For indexing forward (`indexForward.js`), it gets compares the network's latest block to it's own latest block indexed, and attempts to index *Max(currBlock + N, latestNetworkBlock)* periodically. As network blocks obviously keep proceeding forward, the indexer keeps pace with this as well.

* Processing
  * Once these events are fetched, they must be processed to extract necessary transaction information out of their event logs, which is done in `processEvents.js` and then stored in the DB 
  * We process two types of transactions, `OUT` events which is from the user's end and `IN` events which is from the validators. Both of these combined form a complete bridge transaction