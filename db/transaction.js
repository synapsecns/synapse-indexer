import mongoose from 'mongoose'

/**
 * Mongoose schema for transaction
 */
const bridgeTransactionSchema = new mongoose.Schema({
    fromTxnHash: String,
    toTxnHash: String,
    toAddress: String,
    fromAddress: String,

    sentValue: String,
    sentValueFormatted: Number,
    sentValueUSD: Number,

    receivedValue: String,
    receivedValueFormatted: Number,
    receivedValueUSD: Number,

    fromChainId: Number,
    toChainId: Number,
    sentTime: Number,
    receivedTime: Number,
    sentTokenSymbol: String,
    sentTokenAddress: String,
    receivedTokenSymbol: String,
    receivedTokenAddress: String,
    kappa: String,
    pending: Boolean,
    swapSuccess: Boolean,
});

export const BridgeTransaction = mongoose.model('BridgeTransaction', bridgeTransactionSchema);
