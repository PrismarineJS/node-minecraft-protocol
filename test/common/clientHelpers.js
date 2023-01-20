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

  return client
}
