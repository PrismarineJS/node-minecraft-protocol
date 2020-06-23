const mc = require('minecraft-protocol')

const server = mc.createServer({
  'online-mode': false, // optional
  encryption: false, // optional
  host: '0.0.0.0', // optional
  port: 25565, // optional
  version: '1.16'
})

server.on('login', function (client) {
  client.registerChannel('MC|Brand', ['string', []])
  client.on('MC|Brand', console.log)
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
