const states = require('../states')

module.exports = function (client, server, { version }) {
  client.once('set_protocol', onHandshake)

  function onHandshake (packet) {
    client.serverHost = packet.serverHost
    client.serverPort = packet.serverPort
    client.protocolVersion = packet.protocolVersion

    if (version === false || version === undefined) {
      if (require('minecraft-data')(client.protocolVersion)) {
        client.version = client.protocolVersion
      } else {
        client.end('Protocol version ' + client.protocolVersion + ' is not supported')
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
