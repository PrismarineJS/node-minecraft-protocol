const mc = require('minecraft-protocol')

const server = mc.createServer({
  'online-mode': false, // optional
  encryption: false, // optional
  host: '0.0.0.0', // optional
  port: 25565, // optional
  version: '1.16'
})
const mcData = require('minecraft-data')(server.version)
const loginPacket = mcData.loginPacket

server.on('login', function (client) {
  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 255,
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
  client.registerChannel('CUSTOM|ChannelOne', ['i32', []], true)
  client.registerChannel('CUSTOM|ChannelTwo', ['i32', []], true)
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })
  client.writeChannel('CUSTOM|ChannelTwo', 10)
  client.on('CUSTOM|ChannelOne', console.log)
})
