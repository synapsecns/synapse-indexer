/**
 * This data-structure maps Ethereum Events defined on the Synapse Bridge
 * https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol
 * to their keccak hash of the event signature and direction the event, e.i if the
 * event part of a transaction INTO a chain, or was it OUT OF a chain.
 * The IN and OUT transactions combined form a bridge transaction
 *
 * @type {{TokenRedeemAndSwap: {hash: string, direction: string}}}
 */
export const Topics = {
    "0x91f25e9be0134ec851830e0e76dc71e06f9dade75a9b84e9524071dbbc319425": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L116
        eventName: "TokenRedeemAndSwap",
        direction: "OUT"
    },

    "0x4f56ec39e98539920503fd54ee56ae0cbebe9eb15aa778f18de67701eeae7c65": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L104
        eventName: "TokenMintAndSwap",
        direction: "IN"
    },

    "0x9a7024cde1920aa50cdde09ca396229e8c4d530d5cfdc6233590def70a94408c": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L126
        eventName: "TokenRedeemAndRemove",
        hash: "0x9a7024cde1920aa50cdde09ca396229e8c4d530d5cfdc6233590def70a94408c",
        direction: "OUT"
    },

    "0xdc5bad4651c5fbe9977a696aadc65996c468cde1448dd468ec0d83bf61c4b57c": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L74
        eventName: "TokenRedeem",
        direction: "OUT"
    },

    "0xbf14b9fde87f6e1c29a7e0787ad1d0d64b4648d8ae63da21524d9fd0f283dd38": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L87
        eventName: "TokenMint",
        direction: "IN"
    },

    "0x79c15604b92ef54d3f61f0c40caab8857927ca3d5092367163b4562c1699eb5f": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L94
        eventName: "TokenDepositAndSwap",
        direction: "OUT"
    },

    "0xc1a608d0f8122d014d03cc915a91d98cef4ebaf31ea3552320430cba05211b6d": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L135
        eventName: "TokenWithdrawAndRemove",
        direction: "IN"
    },

    "0xda5273705dbef4bf1b902a131c2eac086b7e1476a8ab0cb4da08af1fe1bd8e3b": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L68
        eventName: "TokenDeposit",
        direction: "OUT"
    },

    "0x8b0afdc777af6946e53045a4a75212769075d30455a212ac51c9b16f9c5c9b26": {
        // https://github.com/synapsecns/synapse-contracts/blob/master/contracts/bridge/SynapseBridge.sol#L80
        eventName: "TokenWithdraw",
        direction: "IN"
    }
}

/**
 *
 * @returns {[String]}
 */
export function getTopicsHash() {
    return Object.keys(Topics);
}

/**
 *
 * @param {string} hash
 * @returns {Object}
 */
export function getEventForTopic(hash) {
    return Topics[hash];
}

/**
 *
 * @returns {[String]}
 */
export function getTopicDirection(hash) {
// INDEX BACKWARDS FROM
    // INDEX BACKWARDS TILL
    // INDEX FORWARD FROM

}