const mc = require('minecraft-protocol')

const server = mc.createServer({
  'online-mode': false, // optional
  encryption: false, // optional
  host: '0.0.0.0', // optional
  port: 25565, // optional
  version: '1.10'
})

server.on('login', function (client) {
  client.registerChannel('MC|Brand', ['string', []])
  client.on('MC|Brand', console.log)
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers,
    reducedDebugInfo: false
  })
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })
  client.writeChannel('MC|Brand', 'vanilla')
})
