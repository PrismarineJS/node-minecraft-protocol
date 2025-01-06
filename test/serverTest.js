/* eslint-env mocha */

const mc = require('../')
const assert = require('power-assert')
const { once } = require('events')
const nbt = require('prismarine-nbt')
const applyClientHelpers = require('./common/clientHelpers')

const { getPort } = require('./common/util')

const w = nbt.comp({
  piglin_safe: nbt.byte(0),
  natural: nbt.byte(1),
  ambient_light: nbt.float(0),
  infiniburn: nbt.string('minecraft:infiniburn_overworld'),
  respawn_anchor_works: nbt.byte(0),
  has_skylight: nbt.byte(1),
  bed_works: nbt.byte(1),
  has_raids: nbt.byte(1),
  name: nbt.string('minecraft:overworld'),
  logical_height: nbt.int(256),
  shrunk: nbt.byte(0),
  ultrawarm: nbt.byte(0),
  has_ceiling: nbt.byte(0)
})

for (const supportedVersion of mc.supportedVersions) {
  let PORT
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version

  const loginPacket = (client, server) => {
    if (mcData.loginPacket) {
      return mcData.loginPacket
    }
    return {
      // 1.7
      entityId: client.id,
      gameMode: 1,
      dimension: (version.version >= 735 ? mcData.loginPacket.dimension : 0),
      difficulty: 2,
      maxPlayers: server.maxPlayers,
      levelType: 'default',
      // 1.8
      reducedDebugInfo: (version.version >= 735 ? false : 0),
      // 1.14
      // removes `difficulty`
      viewDistance: 10,
      // 1.15
      hashedSeed: [0, 0],
      enableRespawnScreen: true,
      // 1.16
      // removed levelType
      previousGameMode: version.version >= 755 ? 0 : 255,
      worldNames: ['minecraft:overworld'],
      dimensionCodec: version.version >= 755 ? mcData.loginPacket.dimensionCodec : (version.version >= 735 ? mcData.loginPacket.dimension : { name: '', type: 'compound', value: { dimension: { type: 'list', value: { type: 'compound', value: [w] } } } }),
      worldName: 'minecraft:overworld',
      isDebug: false,
      isFlat: false,
      // 1.16.2
      isHardcore: false,
      // 1.18
      simulationDistance: 10,
      // 1.19
      // removed `dimension`
      // removed `dimensionCodec`
      registryCodec: {
        type: 'compound',
        name: '',
        value: {}
      },
      worldType: 'minecraft:overworld',
      death: undefined,
      // 1.20.5
      enforceSecureChat: false
      // more to be added
    }
  }

  function sendBroadcastMessage (server, clients, message, sender) {
    if (mcData.supportFeature('signedChat')) {
      server.writeToClients(clients, 'player_chat', {
        plainMessage: message,
        signedChatContent: '',
        unsignedChatContent: JSON.stringify({ text: message }),
        type: mcData.supportFeature('incrementedChatType') ? { registryIndex: 1 } : 0,
        senderUuid: 'd3527a0b-bc03-45d5-a878-2aafdd8c8a43', // random
        senderName: JSON.stringify({ text: sender }),
        senderTeam: undefined,
        timestamp: Date.now(),
        salt: 0n,
        signature: mcData.supportFeature('useChatSessions') ? undefined : Buffer.alloc(0),
        previousMessages: [],
        filterType: 0,
        networkName: JSON.stringify({ text: sender })
      })
    } else {
      server.writeToClients(clients, 'chat', { message: JSON.stringify({ text: message }), position: 0, sender: sender || '0' })
    }
  }

  describe('mc-server ' + supportedVersion + 'v', function () {
    this.timeout(5000)
    this.beforeEach(async function () {
      console.log('🔻 Starting test', this.currentTest.title)
      PORT = await getPort()
      console.log(`Using port for tests: ${PORT}`)
    })

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
      let serverClosed, clientClosed
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'LoginTimeout')
          server.close()
        })
      })
      server.on('close', () => {
        serverClosed = true
        console.log('Server closed')
        checkFinish()
      })
      server.on('listening', function () {
        const client = new mc.Client(false, version.minecraftVersion)
        client.on('end', () => {
          clientClosed = true
          console.log('Client closed')
          checkFinish()
        })
        client.connect(PORT, '127.0.0.1')
      })

      function checkFinish () {
        if (serverClosed && clientClosed) done()
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
      let serverClosed, clientClosed
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'KeepAliveTimeout')
          console.log('Server client disconnected')
          server.close()
        })
      })
      server.on('close', () => {
        serverClosed = true
        console.log('Server closed')
        checkFinish()
      })
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'superpants',
          host: '127.0.0.1',
          port: PORT,
          keepAlive: false,
          version: version.minecraftVersion
        })
        client.on('end', () => {
          clientClosed = true
          console.log('Client closed')
          checkFinish()
        })
      })
      function checkFinish () {
        if (serverClosed && clientClosed) done()
      }
    })

    it('responds to ping requests', function (done) {
      const chatMotd = { // Generated with prismarine-chat MessageBuilder on version 1.16 may change in the future
        extra: [{ color: 'red', text: 'Red text' }],
        bold: true,
        text: 'Example chat mesasge'
      }

      const server = mc.createServer({
        'online-mode': false,
        motd: 'test1234',
        motdMsg: chatMotd,
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
            description: {
              extra: [{ color: 'red', text: 'Red text' }],
              bold: true,
              text: 'Example chat mesasge'
            }
          })
          server.close()
        })
      })
      server.on('close', done)
    })

    it('responds with chatMessage motd\'s', function (done) {
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
        client.on('packet', (data, { name }) => {
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
      const broadcast = (message, exclude) => sendBroadcastMessage(server,
        Object.values(server.clients).filter(client => client !== exclude), message)

      const username = ['player1', 'player2']
      let index = 0
      server.on('playerJoin', function (client) {
        console.log('ChatTest: Player has joined')
        assert.notEqual(client.id, null)
        assert.strictEqual(client.username, username[index++])
        broadcast(client.username + ' joined the game.')
        client.on('end', function () {
          broadcast(client.username + ' left the game.', client)
          if (client.username === 'player2') server.close()
        })
        client.write('login', loginPacket(client, server))

        const handleChat = (packet) => broadcast(`<${client.username}> ${packet.message}`)
        client.on('chat', handleChat)
        client.on('chat_message', handleChat)
      })
      server.on('close', done)

      server.on('listening', function () {
        const player1 = applyClientHelpers(mc.createClient({
          username: 'player1',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        }))
        console.log('ChatTest: Player1 is joining...')

        player1.on('login', async function (packet) {
          console.log('ChatTest: Player 1 has joined')
          const player2 = applyClientHelpers(mc.createClient({
            username: 'player2',
            host: '127.0.0.1',
            version: version.minecraftVersion,
            port: PORT
          }))

          console.log('ChatTest: waiting for next message from P2')
          const p1Join = await player1.nextMessage('player2')

          assert.strictEqual(p1Join, '{"text":"player2 joined the game."}')
          console.log('ChatTest: Got message from P2')
          player2.chat('hi')
          const p2hi = await player1.nextMessage('player2')
          assert.strictEqual(p2hi, '{"text":"<player2> hi"}')

          console.log('ChatTest: Waiting again for next message from P2')
          player1.chat('hello')
          const p1hello = await player2.nextMessage('player1')
          assert.strictEqual(p1hello, '{"text":"<player1> hello"}')

          player2.end()
          const p2leaving = await player1.nextMessage('player2')
          assert.strictEqual(p2leaving, '{"text":"player2 left the game."}')
          player1.end()
        })
      })
    })

    it('kicks clients when invalid credentials', function (done) {
      this.timeout(10000)
      const server = mc.createServer({
        version: version.minecraftVersion,
        port: PORT
      })
      let serverPlayerDisconnected, serverClosed, clientClosed
      server.on('connection', function (client) {
        client.on('end', function (reason) {
          serverPlayerDisconnected = true
          console.log('Server player disconnected')
          checkFinish()
          server.close()
        })
      })
      server.on('close', () => {
        serverClosed = true
        console.log('Server closed')
        checkFinish()
      })
      server.on('listening', function () {
        console.log('Server is listening')
        const client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('end', () => {
          clientClosed = true
          console.log('Client closed')
          checkFinish()
        })
      })
      function checkFinish () {
        if (serverPlayerDisconnected && clientClosed && serverClosed) {
          console.log('Kick test is done')
          callOnce(done)
        }
      }
    }).retries(2)

    it('gives correct reason for kicking clients when shutting down', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      let serverPlayerDisconnected, serverClosed
      server.on('playerJoin', function (client) {
        console.log('Server got player join')
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'ServerShutdown')
          serverPlayerDisconnected = true
          console.log('Server player disconnected')
          checkFinish()
        })
        client.write('login', loginPacket(client, server))
      })
      server.on('close', () => {
        serverClosed = true
        console.log('Server closed')
        checkFinish()
      })
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('playerJoin', function () {
          console.log('Client joined')
          server.close()
        })
      })
      function checkFinish () {
        if (serverPlayerDisconnected && serverClosed) done()
      }
    })

    it('encodes chat packet once and send it to two clients', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      server.on('playerJoin', function (client) {
        client.write('login', loginPacket(client, server))
      })
      server.on('close', done)
      server.on('listening', async function () {
        const player1 = applyClientHelpers(mc.createClient({
          username: 'player1',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        }))
        const player2 = applyClientHelpers(mc.createClient({
          username: 'player2',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        }))
        await Promise.all([once(player1, 'login'), once(player2, 'login')])

        sendBroadcastMessage(server, Object.values(server.clients), 'A message from the server.')

        const results = await Promise.all([player1.nextMessage(), player2.nextMessage()])
        for (const msg of results) {
          assert.strictEqual(msg, '{"text":"A message from the server."}')
        }

        player1.end()
        player2.end()
        await Promise.all([once(player1, 'end'), once(player2, 'end')])
        server.close()
      })
    })

    it('supports bundle packet', function (done) {
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port: PORT
      })
      server.on('playerJoin', function (client) {
        client.on('end', function (reason) {
          assert.strictEqual(reason, 'ServerShutdown')
        })
        client.write('login', loginPacket(client, server))
        client.writeBundle([
          ['update_time', { age: 1, time: 2 }],
          ['close_window', { windowId: 0 }]
        ])
      })
      server.on('close', done)
      server.on('listening', function () {
        const client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('update_time', function () {
          // Below handler synchronously defined should be guaranteed to be called after the above one
          const d1 = Date.now()
          client.on('close_window', function () {
            server.close()
            const d2 = Date.now()
            if (mcData.supportFeature('hasBundlePacket') && (d2 - d1) > 1) {
              throw new Error(`bundle packet constituents did not arrive at once : ${d1}, ${d2}`)
            }
          })
        })
      })
    })
  })
}

function callOnce (fn, ...args) {
  console.log('Call Fn', fn.called)
  if (fn.called) return
  fn(...args)
  fn.called = true
}
