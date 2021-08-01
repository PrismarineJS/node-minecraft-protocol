const mcData = require('minecraft-data')
const states = require('../states')

module.exports = function (client, server, { version }) {
  client.once('set_protocol', onHandshake)

  function onHandshake (packet) {
    client.serverHost = packet.serverHost
    client.serverPort = packet.serverPort
    client.protocolVersion = packet.protocolVersion
    if (version === false || version === undefined) {
      if (client.protocolVersion === 5) { // The first snapshot versions of 1.8 uses the 1.7 protocol id, after 1.8 each snapshot has a different protocol id.
        client.version = '1.7.10'
      } else {
        const postNettyVersions = mcData.postNettyVersionsByProtocolVersion.pc[client.protocolVersion]
        if (postNettyVersions && postNettyVersions.length > 0) {
          client.version = postNettyVersions[0].minecraftVersion
        } else {
          client.end('Protocol version ' + client.protocolVersion + ' is not supported')
        }
      }
    } else if (client.protocolVersion !== server.mcversion.version && packet.nextState !== 1) {
      client.end('Wrong protocol version, expected: ' + server.mcversion.version + ' and you are using: ' + client.protocolVersion)
    }

    if (packet.nextState === 1) {
      client.state = states.STATUS
    } else if (packet.nextState === 2) {
      client.state = states.LOGIN
    }
  }
}
