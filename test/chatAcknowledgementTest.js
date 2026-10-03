/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const { EventEmitter, once } = require('events')
const nbt = require('prismarine-nbt')
const mc = require('../')
const injectChatPlugin = require('../src/client/chat')
const { computeChatChecksum } = require('../src/datatypes/checksums')
const { supportedVersions } = require('../src/version')
const { getPort } = require('./common/util')

const checksumVersions = supportedVersions.filter(version => require('minecraft-data')(version).version['>=']('1.21.5'))

for (const version of checksumVersions) {
  describe(`chat acknowledgements ${version}v`, () => {
    const mcData = require('minecraft-data')(version)

    for (const [outbound, packetName] of [
      ['outbound message', 'chat_message'],
      ['/outbound command', 'chat_command']
    ]) {
      it(`checksums wrapped last-seen messages in acknowledgement order for ${packetName}`, () => {
        const client = new EventEmitter()
        client.version = version
        client.uuid = '00000000-0000-0000-0000-000000000001'

        const writes = []
        client.write = (name, data) => writes.push({ name, data })

        injectChatPlugin(client, {})

        const signatures = []
        for (let i = 1; i <= 21; i++) {
          const signature = Buffer.from([i, i + 1])
          signatures.push(signature)
          client.emit('player_chat', {
            signature,
            senderUuid: '00000000-0000-0000-0000-000000000002',
            plainMessage: `message ${i}`,
            index: i,
            previousMessages: [],
            salt: 1n,
            timestamp: 1n,
            unsignedChatContent: null,
            type: 0,
            networkName: null,
            networkTargetName: null
          })
        }

        client._signedChat(outbound, { timestamp: 1n, salt: 1n })

        const expected = computeChatChecksum(
          signatures.slice(-20).map(signature => ({ signature }))
        )
        assert.strictEqual(writes.length, 1)
        assert.strictEqual(writes[0].name, packetName)
        assert.strictEqual(writes[0].data.checksum, expected)
      })
    }

    it('accepts valid and rejects invalid wrapped acknowledgements between a protocol client and server', async function () {
      this.timeout(10000)

      const port = await getPort()
      const options = {
        'online-mode': false,
        version,
        host: '127.0.0.1',
        port,
        enforceSecureProfile: false,
        enforceChatChecksum: true,
        hideErrors: true
      }
      const server = mc.createServer(options)
      let client

      try {
        const serverClientPromise = new Promise(resolve => {
          server.once('playerJoin', serverClient => {
            serverClient.write('login', mcData.loginPacket)
            resolve(serverClient)
          })
        })

        await once(server, 'listening')
        client = mc.createClient({
          username: 'checksum-test',
          host: '127.0.0.1',
          version,
          port
        })
        const loginPromise = once(client, 'login')
        const serverClient = await serverClientPromise
        await loginPromise

        // Offline mode gets the protocol into play state without external auth.
        // Enabling validation after login lets this test provide a deterministic
        // session key while exercising the real client/server packet path.
        options.enforceSecureProfile = true
        serverClient.settings.disabledChat = false
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
        const sessionUuid = '00000000-0000-0000-0000-000000000003'
        client.profileKeys = { private: privateKey, public: publicKey }
        client._session = { uuid: sessionUuid, index: 0 }
        serverClient.profileKeys = { public: publicKey }
        serverClient._session = { uuid: sessionUuid, index: 0 }

        const signatures = []
        const sendTrackedMessage = async (i) => {
          const signature = Buffer.alloc(256, i)
          signatures.push(signature)
          const packet = {
            globalIndex: i,
            senderUuid: '00000000-0000-0000-0000-000000000002',
            index: i,
            signature,
            plainMessage: `message ${i}`,
            timestamp: BigInt(Date.now()),
            salt: 1n,
            previousMessages: [],
            unsignedChatContent: nbt.comp({ text: nbt.string(`message ${i}`) }),
            filterType: 0,
            type: mcData.supportFeature('chatTypeIsHolder') ? { chatType: 1 } : 0,
            networkName: nbt.comp({ text: nbt.string('sender') }),
            networkTargetName: undefined
          }

          const received = once(client, 'player_chat')
          assert.strictEqual(serverClient.logSentMessageFromPeer(packet), true)
          serverClient.write('player_chat', packet)
          await received
        }
        for (let i = 1; i <= 21; i++) await sendTrackedMessage(i)

        // Exercise the standalone acknowledgement packet as well as the fields
        // carried by chat packets. Normally the client sends this after 64
        // pending messages; a smaller valid offset keeps this test focused.
        const receivedAcknowledgement = once(serverClient, 'message_acknowledgement')
        client.write('message_acknowledgement', { count: client._lastSeenMessages.pending })
        client._lastSeenMessages.pending = 0
        await receivedAcknowledgement

        let validationFailure
        const originalEnd = serverClient.end.bind(serverClient)
        serverClient.end = (reason, ...args) => {
          if (reason === 'multiplayer.disconnect.chat_validation_failed') validationFailure = reason
          return originalEnd(reason, ...args)
        }

        const receivedChat = once(serverClient, 'chat_message')
        client._signedChat('wrapped acknowledgement', {
          timestamp: BigInt(Date.now()),
          salt: 1n
        })
        const [packet] = await receivedChat
        await new Promise(resolve => setImmediate(resolve))

        const expected = computeChatChecksum(
          signatures.slice(-20).map(signature => ({ signature }))
        )
        assert.strictEqual(packet.checksum, expected)
        assert.strictEqual(validationFailure, undefined)

        await sendTrackedMessage(22)
        const originalWrite = client.write.bind(client)
        client.write = (name, params) => {
          if (name === 'chat_message') {
            params = {
              ...params,
              checksum: params.checksum === 255 ? 254 : params.checksum + 1
            }
          }
          return originalWrite(name, params)
        }

        const receivedInvalidChat = once(serverClient, 'chat_message')
        client._signedChat('invalid wrapped acknowledgement', {
          timestamp: BigInt(Date.now()),
          salt: 2n
        })
        await receivedInvalidChat
        await new Promise(resolve => setImmediate(resolve))
        assert.strictEqual(validationFailure, 'multiplayer.disconnect.chat_validation_failed')
      } finally {
        if (client) client.end()
        const closed = once(server, 'close')
        server.close()
        await closed
      }
    })
  })
}
