/* eslint-env mocha */

const assert = require('assert')
const EventEmitter = require('events')
const injectChatPlugin = require('../src/client/chat')
const { computeChatChecksum } = require('../src/datatypes/checksums')
const { supportedVersions } = require('../src/version')

const checksumVersions = supportedVersions.filter(version => require('minecraft-data')(version).version['>=']('1.21.5'))

for (const version of checksumVersions) {
  describe(`chat acknowledgements ${version}v`, () => {
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
  })
}
