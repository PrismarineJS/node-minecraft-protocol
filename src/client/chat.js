const states = require('../states')

module.exports = (client, options) => {
  const mcData = require('minecraft-data')(client.version)
  const players = {} // 1.19+

  function onChat (packet, isServerChat = false) {
    let message = packet.message ?? packet.unsignedChatContent ?? packet.signedChatContent
    if (isServerChat) message = packet.content

    const verified = packet.signature ? client.verifyMessage(players[packet.senderUuid].publicKey, packet) : null
    client.emit('chat_received', { verified, message, isServerChat })
  }

  client.on('chat', packet => onChat(packet))
  client.on('player_chat', packet => onChat(packet))
  client.on('system_chat', packet => onChat(packet, true))
  client.on('player_info', (packet) => {
    if (packet.action === 0) { // add player
      for (const player of packet.data) {
        players[player.UUID] = player.crypto
      }
    }
  })

  client.on('state', function (newState) {
    if (newState === states.PLAY) {
      client.chat = (message) => {
        if (mcData.supportFeature('signedChat')) {
          const timestamp = BigInt(Date.now())
          client.write('chat_message', {
            message,
            timestamp,
            salt: 0,
            signature: client.signMessage(message, timestamp)
          })
        } else {
          client.write('chat', { message })
        }
      }
    }
  })
}
