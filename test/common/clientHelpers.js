const { once } = require('events')

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

  client.nextMessage = async (containing) => {
    while (true) {
      const [packet] = await once(client, hasSignedChat ? 'player_chat' : 'chat')
      const m = packet.message || packet.unsignedChatContent || packet.signedChatContent
      if (containing) {
        if (m.includes(containing)) return m
        else continue
      }
      return m
    }
  }

  return client
}
