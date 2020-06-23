/* eslint-env mocha */

const mc = require('../')
const os = require('os')
const path = require('path')
const assert = require('power-assert')
const SURVIVE_TIME = 10000
const MC_SERVER_PATH = path.join(__dirname, 'server')

const Wrap = require('minecraft-wrap').Wrap

const { firstVersion, lastVersion } = require('./common/parallel')

const download = require('minecraft-wrap').download

mc.supportedVersions.forEach(function (supportedVersion, i) {
  if (!(i >= firstVersion && i <= lastVersion)) { return }

  const PORT = Math.round(30000 + Math.random() * 20000)
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version
  const MC_SERVER_JAR_DIR = process.env.MC_SERVER_JAR_DIR || os.tmpdir()
  const MC_SERVER_JAR = MC_SERVER_JAR_DIR + '/minecraft_server.' + version.minecraftVersion + '.jar'
  const wrap = new Wrap(MC_SERVER_JAR, MC_SERVER_PATH + '_' + supportedVersion, {
    minMem: 1024,
    maxMem: 1024
  })
  wrap.on('line', function (line) {
    console.log(line)
  })

  describe('client ' + version.minecraftVersion, function () {
    this.timeout(10 * 60 * 1000)

    before(download.bind(null, version.minecraftVersion, MC_SERVER_JAR))

    after(function (done) {
      wrap.deleteServerData(function (err) {
        if (err) { console.log(err) }
        done(err)
      })
    })

    describe('offline', function () {
      before(function (done) {
        console.log(new Date() + 'starting server ' + version.minecraftVersion)
        wrap.startServer({
          'online-mode': 'false',
          'server-port': PORT,
          motd: 'test1234',
          'max-players': 120
        }, function (err) {
          if (err) { console.log(err) }
          console.log(new Date() + 'started server ' + version.minecraftVersion)
          done(err)
        })
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
        const client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('error', err => done(err))
        const lineListener = function (line) {
          const match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/)
          if (!match) return
          assert.strictEqual(match[1], 'Player')
          assert.strictEqual(match[2], 'hello everyone; I have logged in.')
          wrap.writeServer('say hello\n')
        }
        wrap.on('line', lineListener)
        let chatCount = 0
        client.on('login', function (packet) {
          assert.strictEqual(packet.gameMode, 0)
          client.write('chat', {
            message: 'hello everyone; I have logged in.'
          })
        })
        client.on('chat', function (packet) {
          chatCount += 1
          assert.ok(chatCount <= 2)
          const message = JSON.parse(packet.message)
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
            assert.deepEqual(message.with[1].extra ? (message.with[1].extra[0].text
              ? message.with[1].extra[0].text : message.with[1].extra[0]) : message.with[1].text, 'hello')
            wrap.removeListener('line', lineListener)
            client.end()
            done()
          }
        })
      })

      it('does not crash for ' + SURVIVE_TIME + 'ms', function (done) {
        const client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port: PORT
        })
        client.on('error', err => done(err))
        client.on('login', function () {
          client.write('chat', {
            message: 'hello everyone; I have logged in.'
          })
          setTimeout(function () {
            client.end()
            done()
          }, SURVIVE_TIME)
        })
      })

      it('produce a decent error when connecting with the wrong version', function (done) {
        const client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion === '1.8.8' ? '1.11.2' : '1.8.8',
          port: PORT
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

    describe('online', function () {
      before(function (done) {
        console.log(new Date() + 'starting server ' + version.minecraftVersion)
        wrap.startServer({
          'online-mode': 'true',
          'server-port': PORT
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

      it.skip('connects successfully - online mode', function (done) {
        const client = mc.createClient({
          username: process.env.MC_USERNAME,
          password: process.env.MC_PASSWORD,
          version: version.minecraftVersion,
          port: PORT
        })
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
          client.write('chat', {
            message: 'hello everyone; I have logged in.'
          })
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
          port: PORT
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
})
