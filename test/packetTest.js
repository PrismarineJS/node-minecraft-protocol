/* eslint-env mocha */

const mc = require('../')
const Client = mc.Client
const Server = mc.Server
const net = require('net')
const assert = require('power-assert')
const getFieldInfo = require('protodef').utils.getFieldInfo
const getField = require('protodef').utils.getField

const { getPort } = require('./common/util')

function evalCount (count, fields) {
  if (fields[count.field] in count.map) { return count.map[fields[count.field]] }
  return count.default
}

const slotValue = {
  present: true,
  blockId: 5,
  itemDamage: 2,
  nbtData: {
    type: 'compound',
    name: 'test',
    value: {
      test1: { type: 'int', value: 4 },
      test2: { type: 'long', value: [12, 42] },
      test3: { type: 'byteArray', value: [32] },
      test4: { type: 'string', value: 'ohi' },
      test5: { type: 'list', value: { type: 'int', value: [4] } },
      test6: { type: 'compound', value: { test: { type: 'int', value: 4 } } },
      test7: { type: 'intArray', value: [12, 42] }
    }
  },
  // 1.20.5
  itemCount: 1,
  itemId: 1111,
  addedComponentCount: 0,
  removedComponentCount: 0,
  components: [],
  removeComponents: []
}

const nbtValue = {
  type: 'compound',
  name: 'test',
  value: {
    test1: { type: 'int', value: 4 },
    test2: { type: 'long', value: [12, 42] },
    test3: { type: 'byteArray', value: [32] },
    test4: { type: 'string', value: 'ohi' },
    test5: { type: 'list', value: { type: 'int', value: [4] } },
    test6: { type: 'compound', value: { test: { type: 'int', value: 4 } } },
    test7: { type: 'intArray', value: [12, 42] }
  }
}

function getFixedPacketPayload (version, packetName) {
  if (packetName === 'teams') {
    if (version['>=']('1.21.6')) {
      return {
        team: 'test_team',
        mode: 'add',
        name: nbtValue,
        flags: 'always',
        nameTagVisibility: 'always',
        collisionRule: 'always',
        formatting: 0, // no formatting
        prefix: nbtValue,
        suffix: nbtValue,
        players: ['player1', 'player2']
      }
    }
  }
  if (packetName === 'declare_recipes') {
    if (version['>=']('1.21.3')) {
      return {
        recipes: [
          {
            name: 'minecraft:campfire_input',
            items: [
              903,
              976
            ]
          }
        ],
        stoneCutterRecipes: [
          {
            input: {
              ids: [
                6
              ]
            },
            slotDisplay: {
              type: 'item_stack',
              data: slotValue
            }
          }
        ]
      }
    } else if (version['>=']('1.20.5')) {
      return {
        recipes: [
          {
            name: 'minecraft:crafting_decorated_pot',
            type: 'minecraft:crafting_decorated_pot',
            data: {
              category: 0
            }
          }
        ]
      }
    }
  }
  if (packetName === 'player_info') {
    if (version.majorVersion === '1.7') return { playerName: 'test', online: true, ping: 1 }
    if (version['>=']('1.19.3')) {
      return {
        action: {
          _value: 63,
          add_player: true,
          initialize_chat: true,
          update_game_mode: true,
          update_listed: true,
          update_latency: true,
          update_display_name: true
        },
        data: [
          {
            uuid: 'a01e3843-e521-3998-958a-f459800e4d11',
            player: { name: 'Player', properties: [] },
            chatSession: undefined,
            gamemode: 0,
            listed: 1,
            latency: 0,
            displayName: undefined
          }
        ]
      }
    } else {
      return {
        action: 'add_player',
        data: [
          {
            uuid: 'a01e3843-e521-3998-958a-f459800e4d11',
            name: 'Player',
            properties: [],
            gamemode: 0,
            ping: 0,
            displayName: undefined
          }
        ]
      }
    }
  }
}

const values = {
  i32: 123456,
  i16: -123,
  u16: 123,
  varint: 1,
  varlong: -20,
  i8: -10,
  u8: 8,
  ByteArray: [],
  string: 'hi hi this is my client string',
  buffer: function (typeArgs, context) {
    let count
    if (typeof typeArgs.count === 'number') {
      count = typeArgs.count
    } else if (typeof typeArgs.count === 'object') {
      count = evalCount(typeArgs.count, context)
    } else if (typeArgs.count !== undefined) {
      count = getField(typeArgs.count, context)
    } else if (typeArgs.countType !== undefined) {
      count = 8
    }

    return Buffer.alloc(count)
  },
  array: function (typeArgs, context) {
    let count
    if (typeof typeArgs.count === 'number') {
      count = typeArgs.count
    } else if (typeof typeArgs.count === 'object') {
      count = evalCount(typeArgs.count, context)
    } else if (typeArgs.count !== undefined) {
      count = getField(typeArgs.count, context)
    } else if (typeArgs.countType !== undefined) {
      count = 1
    }
    const arr = []
    while (count > 0) {
      arr.push(getValue(typeArgs.type, context))
      count--
    }
    return arr
  },
  container: function (typeArgs, context) {
    const results = {
      '..': context
    }
    Object.keys(typeArgs).forEach(function (index) {
      const v = typeArgs[index].name === 'type' && typeArgs[index].type === 'string' && typeArgs[2] !== undefined &&
        typeArgs[2].type !== undefined
        ? (typeArgs[2].type[1].fields['minecraft:crafting_shapeless'] === undefined ? 'crafting_shapeless' : 'minecraft:crafting_shapeless')
        : getValue(typeArgs[index].type, results)
      if (typeArgs[index].anon) {
        Object.keys(v).forEach(key => {
          results[key] = v[key]
        })
      } else {
        results[typeArgs[index].name] = v
      }
    })
    delete results['..']
    return results
  },
  vec2f: {
    x: 0, y: 0
  },
  vec3f: {
    x: 0, y: 0, z: 0
  },
  vec3f64: {
    x: 0, y: 0, z: 0
  },
  vec4f: {
    x: 0, y: 0, z: 0, w: 0
  },
  vec3i: {
    x: 0, y: 0, z: 0
  },
  count: 1, // TODO : might want to set this to a correct value
  bool: true,
  f64: 99999.2222,
  f32: -333.444,
  slot: slotValue,
  Slot: slotValue,
  UntrustedSlot: slotValue,
  HashedSlot: slotValue,
  SlotComponent: {
    type: 'hide_tooltip'
  },
  ChatTypes: {
    registryIndex: 1
  },
  SlotComponentType: 0,
  nbt: nbtValue,
  optionalNbt: nbtValue,
  compressedNbt: nbtValue,
  anonymousNbt: nbtValue,
  anonOptionalNbt: nbtValue,
  previousMessages: [],
  i64: [0, 1],
  u64: [0, 1],
  entityMetadata: [
    { key: 17, value: 0, type: 0 }
  ],
  topBitSetTerminatedArray: [
    {
      slot: 0,
      item: slotValue
    },
    {
      slot: 1,
      item: slotValue
    }
  ],
  objectData: {
    intField: 9,
    velocityX: 1,
    velocityY: 2,
    velocityZ: 3
  },
  UUID: '00112233-4455-6677-8899-aabbccddeeff',
  position: { x: 12, y: 100, z: 4382821 },
  position_ibi: { x: 12, y: 100, z: 4382821 },
  position_isi: { x: 12, y: 100, z: 4382821 },
  position_iii: { x: 12, y: 100, z: 4382821 },
  restBuffer: Buffer.alloc(0),
  switch: function (typeArgs, context) {
    const i = typeArgs.fields[getField(typeArgs.compareTo, context)]
    if (i === undefined) {
      if (typeArgs.default === undefined) {
        typeArgs.default = 'void'
        // throw new Error("couldn't find the field " + typeArgs.compareTo + ' of the compareTo and the default is not defined')
      }
      return getValue(typeArgs.default, context)
    } else { return getValue(i, context) }
  },
  option: function (typeArgs, context) {
    return getValue(typeArgs, context)
  },
  bitfield: function (typeArgs, context) {
    const results = {}
    Object.keys(typeArgs).forEach(function (index) {
      results[typeArgs[index].name] = 1
    })
    return results
  },
  mapper: '',
  tags: [{ tagName: 'hi', entries: [1, 2, 3, 4, 5] }],
  ingredient: [slotValue],
  particleData: null,
  chunkBlockEntity: { x: 10, y: 11, z: 12, type: 25 },
  command_node: {
    flags: {
      has_custom_suggestions: 1,
      has_redirect_node: 1,
      has_command: 1,
      command_node_type: 2
    },
    children: [23, 29],
    redirectNode: 83,
    extraNodeData: {
      name: 'command_node name',
      parser: 'brigadier:double',
      properties: {
        flags: {
          max_present: 1,
          min_present: 1
        },
        min: -5.0,
        max: 256.0
      },
      suggestionType: 'minecraft:summonable_entities'
    }
  },
  bitflags: function (typeArgs, context) {
    const results = {}
    Object.keys(typeArgs.flags).forEach(function (index) {
      results[typeArgs.flags[index]] = true
    })
    return results
  },
  registryEntryHolder (typeArgs, context) {
    return { [typeArgs.baseName]: 1 }
  },
  soundSource: 'master',
  packedChunkPos: {
    x: 10,
    z: 12
  },
  particle: {
    particleId: 0,
    data: null
  },
  Particle: {},
  SpawnInfo: {
    dimension: 0,
    name: 'minecraft:overworld',
    hashedSeed: [
      572061085,
      1191958278
    ],
    gamemode: 'survival',
    previousGamemode: 255,
    isDebug: false,
    isFlat: false,
    portalCooldown: 0
  },
  MovementFlags: {
    onGround: true,
    hasHorizontalCollision: false
  },
  ContainerID: 0,
  PositionUpdateRelatives: {
    x: true,
    y: true,
    z: true,
    yaw: true,
    pitch: true,
    dx: true,
    dy: true,
    dz: true,
    yawDelta: true
  },
  RecipeDisplay: {
    type: 'stonecutter',
    data: {
      ingredient: { type: 'empty' },
      result: { type: 'empty' },
      craftingStation: { type: 'empty' }
    }
  },
  SlotDisplay: { type: 'empty' },
  game_profile: {
    name: 'test',
    properties: [{
      key: 'foo',
      value: 'bar'
    }]
  },
  optvarint: 1,
  chat_session: {
    uuid: '00112233-4455-6677-8899-aabbccddeeff',
    publicKey: {
      expireTime: 30,
      keyBytes: [],
      keySignature: []
    }
  },
  IDSet: { ids: [2, 5] },
  ItemSoundHolder: { soundId: 1 },
  ChatTypesHolder: { chatType: 1 },
  ExactComponentMatcher: [],
  HashedStack: {
    itemId: 1,
    count: 1,
    addedComponents: [],
    removedComponents: []
  },
  RecipeBookSetting: {
    open: false,
    filtering: false
  }
}

function getValue (_type, packet) {
  const fieldInfo = getFieldInfo(_type)
  if (typeof values[fieldInfo.type] === 'function') {
    return values[fieldInfo.type](fieldInfo.typeArgs, packet)
  } else if (values[fieldInfo.type] !== undefined) {
    return values[fieldInfo.type]
  } else if (fieldInfo.type !== 'void') {
    throw new Error('No value for type ' + fieldInfo.type)
  }
}

for (const supportedVersion of mc.supportedVersions) {
  let PORT

  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version
  const packets = mcData.protocol

  describe('packets ' + supportedVersion + 'v', function () {
    let client, server, serverClient
    before(async function () {
      PORT = await getPort()
      server = new Server(version.minecraftVersion)
      if (mcData.supportFeature('mcDataHasEntityMetadata')) {
        values.entityMetadata[0].type = 'byte'
      } else {
        values.entityMetadata[0].type = 0
      }
      return new Promise((resolve) => {
        console.log(`Using port for tests: ${PORT}`)
        server.once('listening', function () {
          server.once('connection', function (c) {
            serverClient = c
            resolve()
          })
          client = new Client(false, version.minecraftVersion)
          client.setSocket(net.connect(PORT, 'localhost'))
        })
        server.listen(PORT, 'localhost')
      })
    })
    after(function (done) {
      client.on('end', function () {
        server.on('close', done)
        server.close()
      })
      client.end()
    })
    let packetInfo
    Object.keys(packets).filter(function (state) { return state !== 'types' })
      .forEach(function (state) {
        Object.keys(packets[state]).forEach(function (direction) {
          Object.keys(packets[state][direction].types)
            .filter(function (packetName) {
              return packetName !== 'packet' && packetName.startsWith('packet_')
            })
            .forEach(function (packetName) {
              packetInfo = packets[state][direction].types[packetName]
              packetInfo = packetInfo || null
              if (packetName.includes('bundle_delimiter')) return // not a real packet
              if (['packet_set_projectile_power', 'packet_debug_sample_subscription'].includes(packetName)) return
              it(state + ',' + (direction === 'toServer' ? 'Server' : 'Client') + 'Bound,' + packetName,
                callTestPacket(mcData, packetName.substr(7), packetInfo, state, direction === 'toServer'))
            })
        })
      })
    function callTestPacket (mcData, packetName, packetInfo, state, toServer) {
      return function (done) {
        client.state = state
        serverClient.state = state
        testPacket(mcData, packetName, packetInfo, state, toServer, done)
      }
    }

    function testPacket (mcData, packetName, packetInfo, state, toServer, done) {
      // empty object uses default values
      const packet = getFixedPacketPayload(mcData.version, packetName) || getValue(packetInfo, {})
      if (toServer) {
        console.log('Writing to server', packetName, JSON.stringify(packet))
        serverClient.once(packetName, function (receivedPacket) {
          console.log('Recv', packetName)
          try {
            assertPacketsMatch(packet, receivedPacket)
          } catch (e) {
            console.log(packet, receivedPacket)
            throw e
          }
          done()
        })
        client.write(packetName, packet)
      } else {
        console.log('Writing to client', packetName, JSON.stringify(packet))
        client.once(packetName, function (receivedPacket) {
          console.log('Recv', packetName)
          assertPacketsMatch(packet, receivedPacket)
          done()
        })
        serverClient.write(packetName, packet)
      }
    }

    function assertPacketsMatch (p1, p2) {
      packetInfo.forEach(function (field) {
        assert.deepEqual(p1[field], p2[field])
      })
      Object.keys(p1).forEach(function (field) {
        if (p1[field] !== undefined) {
          assert.ok(field in p2, 'field ' + field +
            ' missing in p2, in p1 it has value ' + JSON.stringify(p1[field]))
        }
      })
      Object.keys(p2).forEach(function (field) {
        if (p2[field] !== undefined) {
          assert.ok(field in p1, 'field ' + field + ' missing in p1, in p2 it has value ' +
            JSON.stringify(p2[field]))
        }
      })
    }
  })
}
