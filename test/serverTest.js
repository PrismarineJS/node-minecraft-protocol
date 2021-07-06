/* eslint-env mocha */

const mc = require('../')
const assert = require('power-assert')
const { once } = require('events')

const { getPort } = require('./common/util')

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

for (const supportedVersion of mc.supportedVersions) {
  let PORT
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version

  describe('mc-server ' + version.minecraftVersion, function () {

    this.beforeAll(async function() {
      PORT = await getPort()
      console.log(`Using port for tests: ${PORT}`)
    })

    this.timeout(5000)
    it('starts listening and shuts down cleanly', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      let listening = false
      server.on('listening', function () {
        listening = true
        server.close()
      })
      server.on('close', function () {
        assert.ok(listening)
        done()
      })
    })
    it('kicks clients that do not log in', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        kickTimeout: 100,
        checkTimeoutInterval: 10,
        version: version.minecraftVersion,
        port: PORT
      })
      let count = 2
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'LoginTimeout')
          server.close()
        })
      })
      server.on('close', function () {
        resolve()
      })
      server.on('listening', function () {
        const client = new mc.Client(false, version.minecraftVersion)
        client.on('end', function () {
          resolve()
        })
        client.connect(PORT, '127.0.0.1')
      })

      function resolve () {
        count -= 1
        if (count <= 0) done()
      }
    })
    it('kicks clients that do not send keepalive packets', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        kickTimeout: 100,
        checkTimeoutInterval: 10,
        version: version.minecraftVersion,
        port: PORT
      })
      let count = 2
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'KeepAliveTimeout')
          server.close()
        })
      })
      server.on('close', function () {
        resolve()
      })
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'superpants',
          host: '127.0.0.1',
          port: PORT,
          keepAlive: false,
          version: version.minecraftVersion
        })
        client.on('end', function () {
          resolve()
        })
      })
      function resolve () {
        count -= 1
        if (count <= 0) done()
      }
    })
    it('responds to ping requests', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        motd: 'test1234',
        'max-players': 120,
        version: version.minecraftVersion,
        port: PORT
      })
      server.on('listening', function () {
        mc.ping({
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        }, function (err, results) {
          if (err) return done(err)
          assert.ok(results.latency >= 0)
          assert.ok(results.latency <= 1000)
          delete results.latency
          assert.deepEqual(results, {
            version: {
              name: version.minecraftVersion,
              protocol: version.version
            },
            players: {
              max: 120,
              online: 0,
              sample: []
            },
            description: { text: 'test1234' }
          })
          server.close()
        })
      })
      server.on('close', done)
    })
    it('clients can be changed by beforeLogin', function (done) {
      const notchUUID = '069a79f4-44e9-4726-a5be-fca90e38aaf5'
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT,
        beforeLogin: (client) => {
          client.uuid = notchUUID
        }
      })
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'notNotch',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('packet', (data, {name})=>{
          if (name === 'success') {
            assert.strictEqual(data.uuid, notchUUID, 'UUID')
            server.close()
          }
        })
      })
      server.on('close', done)
    })
    it('clients can log in and chat', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      const username = ['player1', 'player2']
      let index = 0
      server.on('login', function (client) {
        assert.notEqual(client.id, null)
        assert.strictEqual(client.username, username[index++])
        broadcast(client.username + ' joined the game.')
        client.on('end', function () {
          broadcast(client.username + ' left the game.', client)
          if (client.username === 'player2') server.close()
        })
        const loginPacket = {
          entityId: client.id,
          levelType: 'default',
          gameMode: 1,
          previousGameMode: version.version >= 755 ? 0 : 255,
          worldNames: ['minecraft:overworld'],
          dimensionCodec: version.version >= 755 ? mcData.loginPacket.dimensionCodec : (version.version >= 735 ? mcData.loginPacket.dimension : { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [w] } } } }),
          dimension: (version.version >= 735 ? mcData.loginPacket.dimension : 0),
          worldName: 'minecraft:overworld',
          hashedSeed: [0, 0],
          difficulty: 2,
          maxPlayers: server.maxPlayers,
          reducedDebugInfo: (version.version >= 735 ? false : 0),
          enableRespawnScreen: true
        }
        if (version.version >= 735) { // 1.16x
          loginPacket.isDebug = false
          loginPacket.isFlat = false
          loginPacket.isHardcore = false
          loginPacket.viewDistance = 10
          delete loginPacket.levelType
          delete loginPacket.difficulty
        }
        client.write('login', loginPacket)
        client.on('chat', function (packet) {
          const message = '<' + client.username + '>' + ' ' + packet.message
          broadcast(message)
        })
      })
      server.on('close', done)
      server.on('listening', function () {
        const player1 = mc.createClient({
          username: 'player1',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        player1.on('login', function (packet) {
          assert.strictEqual(packet.gameMode, 1)
          player1.once('chat', function (packet) {
            assert.strictEqual(packet.message, '{"text":"player2 joined the game."}')
            player1.once('chat', function (packet) {
              assert.strictEqual(packet.message, '{"text":"<player2> hi"}')
              player2.once('chat', fn)
              function fn (packet) {
                if (/<player2>/.test(packet.message)) {
                  player2.once('chat', fn)
                  return
                }
                assert.strictEqual(packet.message, '{"text":"<player1> hello"}')
                player1.once('chat', function (packet) {
                  assert.strictEqual(packet.message, '{"text":"player2 left the game."}')
                  player1.end()
                })
                player2.end()
              }

              player1.write('chat', { message: 'hello' })
            })
            player2.write('chat', { message: 'hi' })
          })
          const player2 = mc.createClient({
            username: 'player2',
            host: '127.0.0.1',
            version: version.minecraftVersion,
            port: PORT
          })
        })
      })

      function broadcast (message, exclude) {
        let client
        for (const clientId in server.clients) {
          if (server.clients[clientId] === undefined) continue

          client = server.clients[clientId]
          if (client !== exclude) client.write('chat', { message: JSON.stringify({ text: message }), position: 0, sender: '0' })
        }
      }
    })
    it('kicks clients when invalid credentials', function (done) {
      this.timeout(10000)
      const server = mc.createServer({
        version: version.minecraftVersion,
        port: PORT
      })
      let count = 4
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          resolve()
          server.close()
        })
      })
      server.on('close', function () {
        resolve()
      })
      server.on('listening', function () {
        resolve()
        const client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('end', function () {
          resolve()
        })
      })
      function resolve () {
        count -= 1
        if (count <= 0) done()
      }
    })
    it('gives correct reason for kicking clients when shutting down', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      let count = 2
      server.on('login', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'ServerShutdown')
          resolve()
        })
        const loginPacket = {
          entityId: client.id,
          levelType: 'default',
          gameMode: 1,
          previousGameMode: version.version >= 755 ? 0 : 255,
          worldNames: ['minecraft:overworld'],
          dimensionCodec: version.version >= 755 ? mcData.loginPacket.dimensionCodec : (version.version >= 735 ? mcData.loginPacket.dimension : { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [w] } } } }),
          dimension: (version.version >= 735 ? mcData.loginPacket.dimension : 0),
          worldName: 'minecraft:overworld',
          hashedSeed: [0, 0],
          difficulty: 2,
          maxPlayers: server.maxPlayers,
          reducedDebugInfo: (version.version >= 735 ? false : 0),
          enableRespawnScreen: true
        }
        if (version.version >= 735) { // 1.16x
          loginPacket.isDebug = false
          loginPacket.isFlat = false
          loginPacket.isHardcore = false
          loginPacket.viewDistance = 10
          delete loginPacket.levelType
          delete loginPacket.difficulty
        }
        client.write('login', loginPacket)
      })
      server.on('close', function () {
        resolve()
      })
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('login', function () {
          server.close()
        })
      })
      function resolve () {
        count -= 1
        if (count <= 0) done()
      }
    })
    it('encodes chat packet once and send it to two clients', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      server.on('login', function (client) {
        const loginPacket = {
          entityId: client.id,
          levelType: 'default',
          gameMode: 1,
          previousGameMode: version.version >= 755 ? 0 : 255,
          worldNames: ['minecraft:overworld'],
          dimensionCodec: version.version >= 755 ? mcData.loginPacket.dimensionCodec : (version.version >= 735 ? mcData.loginPacket.dimension : { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [w] } } } }),
          dimension: (version.version >= 735 ? mcData.loginPacket.dimension : 0),
          worldName: 'minecraft:overworld',
          hashedSeed: [0, 0],
          difficulty: 2,
          maxPlayers: server.maxPlayers,
          reducedDebugInfo: (version.version >= 735 ? false : 0),
          enableRespawnScreen: true
        }
        if (version.version >= 735) { // 1.16x
          loginPacket.isDebug = false
          loginPacket.isFlat = false
          loginPacket.isHardcore = false
          loginPacket.viewDistance = 10
          delete loginPacket.levelType
          delete loginPacket.difficulty
        }
        client.write('login', loginPacket)
      })
      server.on('close', done)
      server.on('listening', async function () {
        const player1 = mc.createClient({
          username: 'player1',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        const player2 = mc.createClient({
          username: 'player2',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        await Promise.all([once(player1, 'login'), once(player2, 'login')])        
        server.writeToClients(Object.values(server.clients), 'chat', { message: JSON.stringify({ text: 'A message from the server.' }), position: 1, sender: '00000000-0000-0000-0000-000000000000' })
        
        let results = await Promise.all([ once(player1, 'chat'), once(player2, 'chat') ])
        results.forEach(res => assert.strictEqual(res[0].message, '{"text":"A message from the server."}'))
        
        player1.end()
        player2.end()
        await Promise.all([once(player1, 'end'), once(player2, 'end')])
        server.close()
      })
    })
  })
}
