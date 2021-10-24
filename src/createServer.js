'use strict'

const Server = require('./server')
const NodeRSA = require('node-rsa')
const plugins = [
  require('./server/handshake'),
  require('./server/keepalive'),
  require('./server/login'),
  require('./server/ping')
]

module.exports = createServer

function createServer (options = {}) {
  const {
    host = undefined, // undefined means listen to all available ipv4 and ipv6 adresses
    // (see https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback for details)
    'server-port': serverPort,
    port = serverPort || 25565,
    motd = 'A Minecraft server',
    'max-players': maxPlayersOld = 20,
    maxPlayers: maxPlayersNew = 20,
    version,
    favicon,
    customPackets
  } = options

  const maxPlayers = options['max-players'] !== undefined ? maxPlayersOld : maxPlayersNew

  const optVersion = version === undefined || version === false ? require('./version').defaultVersion : version

  const mcData = require('minecraft-data')(optVersion)
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`)
  const mcversion = mcData.version
  const hideErrors = options.hideErrors || false

  const server = new Server(mcversion.minecraftVersion, customPackets, hideErrors)
  server.mcversion = mcversion
  server.motd = motd
  server.maxPlayers = maxPlayers
  server.playerCount = 0
  server.onlineModeExceptions = Object.create(null)
  server.favicon = favicon

  // The RSA keypair can take some time to generate
  // and is only needed for online-mode
  // So we generate it lazily when needed
  Object.defineProperty(server, 'serverKey', {
    configurable: true,
    get () {
      this.serverKey = new NodeRSA({ b: 1024 })
      return this.serverKey
    },
    set (value) {
      delete this.serverKey
      this.serverKey = value
    }
  })

  server.on('connection', function (client) {
    plugins.forEach(plugin => plugin(client, server, options))
  })
  server.listen(port, host)
  return server
}
