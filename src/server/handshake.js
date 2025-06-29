const states = require('../states')

module.exports = function (client, server, { version, fallbackVersion }) {
  client.once('set_protocol', onHandshake)

  function onHandshake (packet) {
    client.serverHost = packet.serverHost
    client.serverPort = packet.serverPort
    client.protocolVersion = packet.protocolVersion

    if (version === false) {
      const mcData = require('minecraft-data')(client.protocolVersion)
      if (mcData) {
        client.version = client.protocolVersion
        client._supportFeature = mcData.supportFeature
        client._hasBundlePacket = mcData.supportFeature('hasBundlePacket')
      } else {
        let fallback
        if (fallbackVersion !== undefined) {
          fallback = require('minecraft-data')(fallbackVersion)
        }
        if (fallback) {
          client.version = fallback.version.version
          client._supportFeature = fallback.supportFeature
          client._hasBundlePacket = fallback.supportFeature('hasBundlePacket')
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
