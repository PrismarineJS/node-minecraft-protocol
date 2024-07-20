/* eslint-env mocha */

const mc = require('../')
const os = require('os')
const fs = require('fs')
const path = require('path')
const assert = require('power-assert')
const util = require('util')
const applyClientHelpers = require('./common/clientHelpers')
const download = util.promisify(require('minecraft-wrap').download)
const { getPort } = require('./common/util')

const SURVIVE_TIME = 10000
const MC_SERVER_PATH = path.join(__dirname, 'server')

const Wrap = require('minecraft-wrap').Wrap

for (const supportedVersion of mc.supportedVersions) {
  let PORT = null
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version
  const MC_SERVER_JAR_DIR = process.env.MC_SERVER_JAR_DIR || os.tmpdir()
  const MC_SERVER_JAR = MC_SERVER_JAR_DIR + '/minecraft_server.' + version.minecraftVersion + '.jar'
  const MC_SERVER_DIR = MC_SERVER_PATH + '_' + supportedVersion
  const wrap = new Wrap(MC_SERVER_JAR, MC_SERVER_DIR, {
    minMem: 1024,
    maxMem: 1024
  })
  wrap.on('line', function (line) {
    console.log(line)
  })

  describe('client ' + supportedVersion + 'v', function () {
    this.timeout(10 * 60 * 1000)

    before(async function () {
      this.timeout(30 * 1000)
      await download(version.minecraftVersion, MC_SERVER_JAR)
      PORT = await getPort()
      console.log(`Port chosen: ${PORT}`)
    })

    after(async () => {
      await new Promise((resolve, reject) => {
        wrap.deleteServerData(err => {
          if (err) reject(err)
          resolve()
        })
      })
    })

    describe('offline', function () {
      this.timeout(240 * 1000)
      before(async () => {
        console.log(new Date() + 'starting server ' + version.minecraftVersion)
        await new Promise((resolve, reject) => {
          wrap.startServer({
            'online-mode': 'false',
            'server-port': PORT,
            motd: 'test1234',
            'max-players': 120,
            // 'level-type': 'flat',
            'use-native-transport': 'false' // java 16 throws errors without this, https://www.spigotmc.org/threads/unable-to-access-address-of-buffer.311602
          }, (err) => {
            if (err) reject(err)
            resolve()
          })
        })
        console.log(new Date() + 'started server ' + version.minecraftVersion)
      })

      after(function (done) {
        console.log(new Date() + 'stopping server' + version.minecraftVersion)
        wrap.stopServer(function (err) {
          if (err) { console.log(err) }
          console.log(new Date() + 'stopped server ' + version.minecraftVersion)
          done(err)
        })
      })

      it('pings the server', function (done) {
        mc.ping({
          version: version.minecraftVersion,
          port: PORT
        }, function (err, results) {
          if (err) return done(err)
          assert.ok(results.latency >= 0)
          assert.ok(results.latency <= 1000)
          delete results.latency
          delete results.favicon // too lazy to figure it out
          /*        assert.deepEqual(results, {
           version: {
           name: '1.7.4',
           protocol: 4
           },
           description: { text: "test1234" }
           }); */
          done()
        })
      })

      it('connects successfully - offline mode', function (done) {
        const client = applyClientHelpers(mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port: PORT,
          auth: 'offline'
        }))
        client.on('error', err => done(err))

        client.on('state', (state) => {
          console.log('Client now in state', state)
        })

        // ** Dump some server data **
        fs.rmSync(MC_SERVER_DIR + '_registry_data.json', { force: true })
        client.on('raw.registry_data', (buffer) => {
          fs.writeFileSync(MC_SERVER_DIR + '_registry_data.bin', buffer)
        })
        client.on('registry_data', (json) => {
          if (json.codec) { // Pre 1.20.5, codec is 1 json
            fs.writeFileSync(MC_SERVER_DIR + '_registry_data.json', JSON.stringify(json))
          } else { // 1.20.5+, codec is many nbt's each with their own ids, merge them
            let currentData = {}
            if (fs.existsSync(MC_SERVER_DIR + '_registry_data.json')) {
              currentData = JSON.parse(fs.readFileSync(MC_SERVER_DIR + '_registry_data.json', 'utf8'))
            }
            currentData[json.id] = json
            fs.writeFileSync(MC_SERVER_DIR + '_registry_data.json', JSON.stringify(currentData))
          }
          console.log('Wrote registry data')
        })
        client.on('login', (packet) => {
          fs.writeFileSync(MC_SERVER_DIR + '_login.json', JSON.stringify(packet))
          if (fs.existsSync(MC_SERVER_DIR + '_registry_data.json')) {
            // generate a loginPacket.json for minecraft-data
            const codec = JSON.parse(fs.readFileSync(MC_SERVER_DIR + '_registry_data.json'))
            fs.writeFileSync(MC_SERVER_DIR + '_loginPacket.json', JSON.stringify({
              ...packet,
              dimensionCodec: codec.codec || codec
            }, null, 2))
            console.log('Wrote loginPacket.json')
          }
        })
        // ** End dumping code **

        const lineListener = function (line) {
          const match = line.match(/\[Server thread\/INFO\]: (?:\[Not Secure\] )?<(.+?)> (.+)/)
          if (!match) return
          assert.strictEqual(match[1], 'Player')
          assert.strictEqual(match[2], 'hello everyone; I have logged in.')
          wrap.writeServer('say hello\n')
          wrap.off('line', lineListener)
        }
        wrap.on('line', lineListener)
        let chatCount = 0

        client.on('login', function (packet) {
          if (packet.worldState) { // 1.20.5+
            assert.strictEqual(packet.worldState.gamemode, 'survival')
          } else {
            assert.strictEqual(packet.gameMode, 0)
          }
          client.chat('hello everyone; I have logged in.')
        })
        client.on('playerChat', function (data) {
          chatCount += 1
          assert.ok(chatCount <= 2)

          if (!mcData.supportFeature('clientsideChatFormatting')) {
            const message = JSON.parse(data.formattedMessage)
            if (chatCount === 1) {
              assert.strictEqual(message.translate, 'chat.type.text')
              assert.deepEqual(message.with[0].clickEvent, {
                action: 'suggest_command',
                value: mcData.version.version > 340 ? '/tell Player ' : '/msg Player '
              })
              assert.deepEqual(message.with[0].text, 'Player')
              assert.strictEqual(message.with[1], 'hello everyone; I have logged in.')
            } else if (chatCount === 2) {
              assert.strictEqual(message.translate, 'chat.type.announcement')
              assert.strictEqual(message.with[0].text ? message.with[0].text : message.with[0], 'Server')
              assert.deepEqual(message.with[1].extra
                ? (message.with[1].extra[0].text
                    ? message.with[1].extra[0].text
                    : message.with[1].extra[0])
                : message.with[1].text, 'hello')
              wrap.removeListener('line', lineListener)
              client.end()
              done()
            }
          } else {
            // 1.19+
            console.log('Chat Message', data)
            const sender = JSON.parse(data.senderName)
            const msgPayload = data.formattedMessage ? JSON.parse(data.formattedMessage) : data.plainMessage
            const plainMessage = client.parseMessage(msgPayload).toString()

            if (chatCount === 1) {
              assert.strictEqual(plainMessage, 'hello everyone; I have logged in.')
              assert.deepEqual(sender.clickEvent, {
                action: 'suggest_command',
                value: '/tell Player '
              })
              assert.strictEqual(sender.text, 'Player')
            } else if (chatCount === 2) {
              const plainSender = client.parseMessage(sender).toString()
              assert.strictEqual(plainMessage, 'hello')
              assert.strictEqual(plainSender, 'Server')
              wrap.removeListener('line', lineListener)
              client.end()
              done()
            }
          }
        })

        client.on('systemChat', function (data) {
          // For 1.7.10
          chatCount += 1
          assert.ok(chatCount <= 2)

          const message = JSON.parse(data.formattedMessage)
          if (chatCount === 1) {
            assert.strictEqual(message.translate, 'chat.type.text')
            assert.deepEqual(message.with[0].clickEvent, {
              action: 'suggest_command',
              value: mcData.version.version > 340 ? '/tell Player ' : '/msg Player '
            })
            assert.deepEqual(message.with[0].text, 'Player')
            assert.strictEqual(message.with[1], 'hello everyone; I have logged in.')
          } else if (chatCount === 2) {
            assert.strictEqual(message.translate, 'chat.type.announcement')
            assert.strictEqual(message.with[0].text ? message.with[0].text : message.with[0], 'Server')
            assert.deepEqual(message.with[1].extra
              ? (message.with[1].extra[0].text
                  ? message.with[1].extra[0].text
                  : message.with[1].extra[0])
              : message.with[1].text, 'hello')
            wrap.removeListener('line', lineListener)
            client.end()
            done()
          }
        })
      })

      it('does not crash for ' + SURVIVE_TIME + 'ms', function (done) {
        const client = applyClientHelpers(mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port: PORT,
          auth: 'offline'
        }))
        client.on('error', err => done(err))
        client.on('login', function () {
          client.chat('hello everyone; I have logged in.')
          setTimeout(function () {
            client.end()
            done()
          }, SURVIVE_TIME)
        })
      })

      it('produce a decent error when connecting with the wrong version', function (done) {
        if (process.platform === 'win32') return done()
        const client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion === '1.8.8' ? '1.11.2' : '1.8.8',
          port: PORT,
          auth: 'offline'
        })
        client.once('error', function (err) {
          if (err.message.startsWith('This server is version')) {
            console.log(new Date() + 'Correctly got an error for wrong version : ' + err.message)
            client.end()
            done()
          } else {
            client.end()
            done(err)
          }
          client.on('error', err => {
            if (err.message.indexOf('ECONNRESET') === -1) {
              done(err)
            }
          })
        })
      })
    })

    describe.skip('online', function () {
      before(function (done) {
        console.log(new Date() + 'starting server ' + version.minecraftVersion)
        wrap.startServer({
          'online-mode': 'true',
          'server-port': PORT,
          'use-native-transport': 'false' // java 16 throws errors without this, https://www.spigotmc.org/threads/unable-to-access-address-of-buffer.311602
        }, function (err) {
          if (err) { console.log(err) }
          console.log(new Date() + 'started server ' + version.minecraftVersion)
          done(err)
        })
      })

      after(function (done) {
        console.log(new Date() + 'stopping server ' + version.minecraftVersion)
        wrap.stopServer(function (err) {
          if (err) { console.log(err) }
          console.log(new Date() + 'stopped server ' + version.minecraftVersion)
          done(err)
        })
      })

      it('connects successfully - online mode', function (done) {
        const client = applyClientHelpers(mc.createClient({
          username: process.env.MC_USERNAME,
          password: process.env.MC_PASSWORD,
          version: version.minecraftVersion,
          port: PORT
        }))
        client.on('error', err => done(err))
        const lineListener = function (line) {
          const match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/)
          if (!match) return
          assert.strictEqual(match[1], client.username)
          assert.strictEqual(match[2], 'hello everyone; I have logged in.')
          wrap.writeServer('say hello\n')
        }
        wrap.on('line', lineListener)
        client.on('login', function (packet) {
          assert.strictEqual(packet.levelType, 'default')
          assert.strictEqual(packet.difficulty, 1)
          assert.strictEqual(packet.dimension, 0)
          assert.strictEqual(packet.gameMode, 0)
          client.chat('hello everyone; I have logged in.')
        })
        let chatCount = 0
        client.on('chat', function (packet) {
          chatCount += 1
          assert.ok(chatCount <= 2)
          if (chatCount === 2) {
            client.removeAllListeners('chat')
            wrap.removeListener('line', lineListener)
            client.end()
            done()
          }
        })
      })

      it('gets kicked when no credentials supplied in online mode', function (done) {
        const client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port: PORT,
          auth: 'offline'
        })
        client.on('error', err => done(err))
        let gotKicked = false
        client.on('disconnect', function (packet) {
          assert.ok(packet.reason.indexOf('"Failed to verify username!"') !== -1 || packet.reason.indexOf('multiplayer.disconnect.unverified_username') !== -1)
          gotKicked = true
        })
        client.on('end', function () {
          assert.ok(gotKicked)
          client.end()
          done()
        })
      })
    })
  })
}
