const mc = require('minecraft-protocol')

const options = {
  motd: 'Vox Industries',
  'max-players': 127,
  port: 25565,
  'online-mode': false
}

const server = mc.createServer(options)
const mcData = require('minecraft-data')(server.version)
const loginPacket = mcData.loginPacket

server.on('login', function (client) {
  broadcast(client.username + ' joined the game.')
  const addr = client.socket.remoteAddress + ':' + client.socket.remotePort
  console.log(client.username + ' connected', '(' + addr + ')')

  client.on('end', function () {
    broadcast(client.username + ' left the game.', client)
    console.log(client.username + ' disconnected', '(' + addr + ')')
  })

  // send init data so client will start rendering world
  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 1,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  })
  client.write('position', {
    x: 0,
    y: 256,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })

  client.on('chat', function (data) {
    const message = '<' + client.username + '>' + ' ' + data.message
    broadcast(message, null, client.username)
    console.log(message)
  })
})

server.on('error', function (error) {
  console.log('Error:', error)
})

server.on('listening', function () {
  console.log('Server listening on port', server.socketServer.address().port)
})

function broadcast (message, exclude, username) {
  let client
  const translate = username ? 'chat.type.announcement' : 'chat.type.text'
  username = username || 'Server'
  for (const clientId in server.clients) {
    if (server.clients[clientId] === undefined) continue

    client = server.clients[clientId]
    if (client !== exclude) {
      const msg = {
        translate: translate,
        with: [
          username,
          message
        ]
      }
      client.write('chat', {
        message: JSON.stringify(msg),
        position: 0,
        sender: '0'
      })
    }
  }
}
