const mc = require('minecraft-protocol')
const Chunk = require('prismarine-chunk')('1.16.3')
const Vec3 = require('vec3')
const server = mc.createServer({
  'online-mode': true,
  encryption: true,
  host: '0.0.0.0',
  port: 25565,
  version: '1.16'
})
const chunk = new Chunk()

for (let x = 0; x < 16; x++) {
  for (let z = 0; z < 16; z++) {
    chunk.setBlockType(new Vec3(x, 100, z), mcData.blocksByName.grass_block.id)
    chunk.setBlockData(new Vec3(x, 100, z), 1)
    for (let y = 0; y < 256; y++) {
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
  });
  client.write('map_chunk', {
    x: 0,
    z: 0,
    groundUp: true,
    biomes: chunk.dumpBiomes !== undefined ? chunk.dumpBiomes() : undefined,
    heightmaps: {
      type: 'compound',
      name: '',
      value: {
        MOTION_BLOCKING: { type: 'longArray', value: new Array(36).fill([0, 0]) }
      }
    }, // send fake heightmap
    bitMap: chunk.getMask(),
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
