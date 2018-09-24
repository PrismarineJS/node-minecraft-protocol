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
    host = '0.0.0.0',
    'server-port': serverPort,
    port = serverPort || 25565,
    motd = 'A Minecraft server',
    'max-players': maxPlayers = 20,
    version,
    favicon,
    customPackets
  } = options

  const optVersion = version === undefined || version === false ? require('./version').defaultVersion : version

  const mcData = require('minecraft-data')(optVersion)
  const mcversion = mcData.version
  const hideErrors = options.hideErrors || false

  const server = new Server(mcversion.minecraftVersion, customPackets, hideErrors)
  server.mcversion = mcversion
  server.motd = motd
  server.maxPlayers = maxPlayers
  server.playerCount = 0
  server.onlineModeExceptions = {}
  server.favicon = favicon
  server.serverKey = new NodeRSA({ b: 1024 })

  server.on('connection', function (client) {
    plugins.forEach(plugin => plugin(client, server, options))
  })
  server.listen(port, host)
  return server
}
