module.exports = client => {
  const mcData = require('minecraft-data')(client.version)
  const hasSignedChat = mcData.supportFeature('signedChat')

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
