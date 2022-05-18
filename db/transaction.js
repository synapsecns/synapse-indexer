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
    receivedValue: String,
    fromChainId: Number,
    toChainId: Number,
    sentTime: Number,
    receivedTime: Number,
    sentTokenSymbol: String,
    sentTokenAddress: String,
    receivedTokenSymbol: String,
    receivedTokenAddress: String,
    kappa: String,
    sentValueUSD: mongoose.Schema.Types.Decimal128,
    receivedValueUSD: mongoose.Schema.Types.Decimal128,
    pending: Boolean,
    swapSuccess: Boolean,
});

export const BridgeTransaction = mongoose.model('BridgeTransaction', bridgeTransactionSchema);
