const endianToggle = require('endian-toggle')

module.exports = function (client, server, { beforePing = null, version, fallbackVersion }) {
  client.once('ping_start', onPing)
  client.once('legacy_server_list_ping', onLegacyPing)

  function onPing () {
    let responseVersion = {
      name: server.mcversion.minecraftVersion,
      protocol: server.mcversion.version
    }

    if (version === false) {
      let minecraftData = require('minecraft-data')(client.protocolVersion)
      if (!minecraftData && fallbackVersion !== undefined) {
        minecraftData = require('minecraft-data')(fallbackVersion)
      }
      if (minecraftData) {
        responseVersion = {
          name: minecraftData.version.minecraftVersion,
          protocol: minecraftData.version.version
        }
      } else {
        responseVersion = {
          name: client.version,
          protocol: client.protocolVersion
        }
      }
    }

    const response = {
      version: responseVersion,
      players: {
        max: server.maxPlayers,
        online: server.playerCount,
        sample: []
      },
      description: server.motdMsg ?? { text: server.motd },
      favicon: server.favicon
    }

    function answerToPing (err, response) {
      if (err) return
      if (response === false) {
        client.socket.destroy()
      } else {
        client.write('server_info', { response: JSON.stringify(response) })
      }
    }

    if (beforePing) {
      if (beforePing.length > 2) {
        beforePing(response, client, answerToPing)
      } else {
        answerToPing(null, beforePing(response, client) || response)
      }
    } else {
      answerToPing(null, response)
    }

    client.once('ping', function (packet) {
      client.write('ping', { time: packet.time })
      client.end()
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
