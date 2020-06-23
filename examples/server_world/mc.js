const mc = require('minecraft-protocol')
const Chunk = require('prismarine-chunk')('1.16')
const Vec3 = require('vec3')
var server = mc.createServer({
  'online-mode': true,
  encryption: true,
  host: '0.0.0.0',
  port: 25565,
  version: '1.16'
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
  const w = {
    piglin_safe: {
      type: 'byte',
      value: 0
    },
    natural: {
      type: 'byte',
      value: 1
    },
    ambient_light: {
      type: 'float',
      value: 0
    },
    infiniburn: {
      type: 'string',
      value: 'minecraft:infiniburn_overworld'
    },
    respawn_anchor_works: {
      type: 'byte',
      value: 0
    },
    has_skylight: {
      type: 'byte',
      value: 1
    },
    bed_works: {
      type: 'byte',
      value: 1
    },
    has_raids: {
      type: 'byte',
      value: 1
    },
    name: {
      type: 'string',
      value: 'minecraft:overworld'
    },
    logical_height: {
      type: 'int',
      value: 256
    },
    shrunk: {
      type: 'byte',
      value: 0
    },
    ultrawarm: {
      type: 'byte',
      value: 0
    },
    has_ceiling: {
      type: 'byte',
      value: 0
    }
  }
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    previousGameMode: 255,
    worldNames: ['minecraft:overworld'],
    dimensionCodec: { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [{ name: w }] } } } },
    dimension: 'minecraft:overworld',
    worldName: 'minecraft:overworld',
    difficulty: 2,
    maxPlayers: server.maxPlayers,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    hashedSeed: [0, 0]
  })
  client.write('map_chunk', {
    x: 0,
    z: 0,
    ignoreOldData: true,
    groundUp: false,
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
