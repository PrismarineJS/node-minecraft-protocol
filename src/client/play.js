const states = require('../states')
const crypto = require('crypto')
const concat = require('../transforms/binaryStream').concat

module.exports = function (client, options) {
  client.once('success', onLogin)

  const EMPTY_BUFFER = Buffer.from([])

  function onLogin (packet) {
    client.state = states.PLAY
    client.uuid = packet.uuid
    client.username = packet.username
    client.signMessage = (message, timestamp, salt = 0) => {
      if (!client.profileKeys) return EMPTY_BUFFER
      const signable = concat('i64', salt, 'UUID', client.uuid, 'i64',
        timestamp / 1000n, 'pstring', JSON.stringify({ text: message }))
      return crypto.sign('RSA-SHA256', signable, client.profileKeys.private)
    }
    client.verifyMessage = (pubKey, packet) => {
      if (pubKey instanceof Buffer) pubKey = crypto.createPublicKey({ key: pubKey, format: 'der', type: 'spki' })
      const signable = concat('i64', packet.salt, 'UUID', packet.senderUuid,
        'i64', packet.timestamp / 1000n, 'pstring', packet.signedChatContent)
      return crypto.verify('RSA-SHA256', signable, pubKey, packet.signature)
    }
  }
}
