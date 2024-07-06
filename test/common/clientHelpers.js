const Registry = require('prismarine-registry')
module.exports = client => {
  client.nextMessage = (containing) => {
    return new Promise((resolve) => {
      function onChat (packet) {
        const m = packet.formattedMessage || packet.unsignedChatContent || JSON.stringify({ text: packet.plainMessage })
        if (containing) {
          if (m.includes(containing)) return finish(m)
          else return
        }
        return finish(m)
      }
      client.on('playerChat', onChat)
      client.on('systemChat', onChat) // For 1.7.10

      function finish (m) {
        client.off('playerChat', onChat)
        client.off('systemChat', onChat)
        resolve(m)
      }
    })
  }

  client.on('login', (packet) => {
    client.registry ??= Registry(client.version)
    if (packet.dimensionCodec) {
      client.registry.loadDimensionCodec(packet.dimensionCodec)
    }
  })
  client.on('registry_data', (data) => {
    client.registry ??= Registry(client.version)
    client.registry.loadDimensionCodec(data.codec || data)
  })

  client.on('playerJoin', () => {
    const ChatMessage = require('prismarine-chat')(client.registry || client.version)
    client.parseMessage = (comp) => {
      return new ChatMessage(comp)
    }
  })

  return client
}
