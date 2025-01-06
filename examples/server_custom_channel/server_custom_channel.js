const mc = require('minecraft-protocol')

const server = mc.createServer({
  'online-mode': false, // optional
  encryption: false, // optional
  version: '1.18.2'
})
const mcData = require('minecraft-data')(server.version)
const loginPacket = mcData.loginPacket

server.on('playerJoin', function (client) {
  client.write('login', {
    ...loginPacket,
    enforceSecureChat: false,
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 1,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  })
  client.registerChannel('node-minecraft-protocol:custom_channel_one', ['string', []], true)
  client.registerChannel('node-minecraft-protocol:custom_channel_two', ['string', []], true)
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })
  client.writeChannel('node-minecraft-protocol:custom_channel_two', 'hello from the server')
  client.on('node-minecraft-protocol:custom_channel_one', console.log)
})
