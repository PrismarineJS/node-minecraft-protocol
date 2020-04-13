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
    host,
    'server-port': serverPort,
    port = serverPort || 25565,
    motd = 'A Minecraft server',
    'max-players': maxPlayersOld,
    maxPlayers: maxPlayersNew = 20,
    version,
    favicon,
    customPackets
  } = options

  if (serverPort) { console.warn('server-port option is deprecated, use  instead') }
  if (maxPlayersOld) { console.warn('max-players option is deprecated, use maxPlayers instead') }

  const maxPlayers = maxPlayersOld !== undefined ? maxPlayersOld : maxPlayersNew

  const optVersion = version || require('./version').defaultVersion

  const mcData = require('minecraft-data')(optVersion)
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`)
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
