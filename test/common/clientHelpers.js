module.exports = client => {
  const mcData = require('minecraft-data')(client.version)
  const hasSignedChat = mcData.supportFeature('signedChat')

  client.chat = (message) => {
    if (hasSignedChat) {
      const timestamp = BigInt(Date.now())
      client.write('chat_message', {
        message,
        timestamp,
        salt: 0,
        signature: Buffer.alloc(0)
      })
    } else {
      client.write('chat', { message })
    }
  }

  client.nextMessage = (containing) => {
    return new Promise((resolve) => {
      function onChat (packet) {
        const m = packet.message || packet.unsignedChatContent || packet.signedChatContent
        if (containing) {
          if (m.includes(containing)) return finish(m)
          else return
        }
        return finish(m)
      }
      client.on(hasSignedChat ? 'player_chat' : 'chat', onChat)

      function finish (m) {
        client.off(hasSignedChat ? 'player_chat' : 'chat', onChat)
        resolve(m)
      }
    })
  }

  return client
}
