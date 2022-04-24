const endianToggle = require('endian-toggle')

module.exports = function (client, server, { beforeServerInfo = null, beforePing = null, version }) {
  client.once('ping_start', onPing)
  client.once('legacy_server_list_ping', onLegacyPing)

  function onPing () {
    // Use client version if dynamic cross version support is enabled.
    const responseVersion = (version === false)
      ? {
          name: client.version,
          protocol: client.protocolVersion
        }
      : {
          name: server.mcversion.minecraftVersion,
          protocol: server.mcversion.version
        }

    const response = {
      version: responseVersion,
      players: {
        max: server.maxPlayers,
        online: server.playerCount,
        sample: []
      },
      description: { text: server.motd },
      favicon: server.favicon
    }

    function answerToServerInfo (err, response) {
      if (err) return
      client.write('server_info', { response: JSON.stringify(response) })
    }

    function answerPing (packet) {
      client.write('ping', { time: packet.time })
      client.end()
    }

    if (beforeServerInfo) {
      if (beforeServerInfo.length > 2) {
        beforeServerInfo(response, client, answerToServerInfo)
      } else {
        answerToServerInfo(null, beforeServerInfo(response, client) || response)
      }
    } else {
      answerToServerInfo(null, response)
    }

    client.once('ping', function (packet) {
      if (beforePing) return beforePing(client, packet)
      answerPing(packet)
    })
  }

  function onLegacyPing (packet) {
    if (packet.payload === 1) {
      const pingVersion = 1
      sendPingResponse('\xa7' + [pingVersion, server.mcversion.version, server.mcversion.minecraftVersion,
        server.motd, server.playerCount.toString(), server.maxPlayers.toString()].join('\0'))
    } else {
      // ping type 0
      sendPingResponse([server.motd, server.playerCount.toString(), server.maxPlayers.toString()].join('\xa7'))
    }

    function sendPingResponse (responseString) {
      function utf16be (s) {
        return endianToggle(Buffer.from(s, 'utf16le'), 16)
      }

      const responseBuffer = utf16be(responseString)

      const length = responseString.length // UCS2 characters, not bytes
      const lengthBuffer = Buffer.alloc(2)
      lengthBuffer.writeUInt16BE(length)

      const raw = Buffer.concat([Buffer.from('ff', 'hex'), lengthBuffer, responseBuffer])

      // client.writeRaw(raw); // not raw enough, it includes length
      client.socket.write(raw)
    }
  }
}
