const mc = require('minecraft-protocol')
const Chunk = require('prismarine-chunk')('1.12.1')
const Vec3 = require('vec3')
var server = mc.createServer({
  'online-mode': true,
  encryption: true,
  host: '0.0.0.0',
  port: 25565,
  version: '1.12.1'
})
var chunk = new Chunk()

for (var x = 0; x < 16; x++) {
  for (var z = 0; z < 16; z++) {
    chunk.setBlockType(new Vec3(x, 100, z), 2)
    for (var y = 0; y < 256; y++) {
      chunk.setSkyLight(new Vec3(x, y, z), 15)
    }
  }
}

server.on('login', function (client) {
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers,
    reducedDebugInfo: false
  })
  client.write('map_chunk', {
    x: 0,
    z: 0,
    groundUp: true,
    bitMap: 0xffff,
    chunkData: chunk.dump(),
    blockEntities: []
  })
  client.write('position', {
    x: 15,
    y: 101,
    z: 15,
    yaw: 137,
    pitch: 0,
    flags: 0x00
  })
})
