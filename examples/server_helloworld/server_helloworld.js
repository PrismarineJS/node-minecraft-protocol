const mc = require('minecraft-protocol')

const options = {
  'online-mode': true,
  version: '1.16'
}

const server = mc.createServer(options)

server.on('login', function (client) {
  const addr = client.socket.remoteAddress
  console.log('Incoming connection', '(' + addr + ')')

  client.on('end', function () {
    console.log('Connection closed', '(' + addr + ')')
  })

  client.on('error', function (error) {
    console.log('Error:', error)
  })

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

  // send init data so client will start rendering world
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    previousGameMode: 255,
    worldNames: ['minecraft:overworld'],
    dimensionCodec: { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [w] } } } },
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

  const msg = {
    translate: 'chat.type.announcement',
    with: [
      'Server',
      'Hello, world!'
    ]
  }
  client.write('chat', { message: JSON.stringify(msg), position: 0, sender: '0' })
})

server.on('error', function (error) {
  console.log('Error:', error)
})

server.on('listening', function () {
  console.log('Server listening on port', server.socketServer.address().port)
})
