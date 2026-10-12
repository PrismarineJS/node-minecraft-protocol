/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const inject = require('../src/server/chat')

for (const version of ['1.19.2']) {
  describe(`${version}v pending chat acknowledgements`, function () {
    let client
    let errors
    let ended
    const sender = '00000000-0000-0000-0000-000000000001'
    const other = '00000000-0000-0000-0000-000000000002'
    const signature = Buffer.alloc(256, 1)

    beforeEach(function () {
      client = new EventEmitter()
      client.supportFeature = require('minecraft-data')(version).supportFeature
      errors = []
      ended = []
      client.on('error', error => errors.push(error))
      client.end = reason => ended.push(reason)
      inject(client, {}, { enforceSecureProfile: true, hideErrors: true })
    })

    function sent (who, sig, timestamp) {
      assert.strictEqual(client.logSentMessageFromPeer({ senderUuid: who, signature: sig, timestamp }), true)
    }

    function acknowledge (entries, rejected) {
      client.emit('message_acknowledgement', {
        previousMessages: entries.map(([messageSender, messageSignature]) => ({ messageSender, messageSignature })),
        lastRejectedMessage: rejected
      })
    }

    it('accepts repeated acknowledgements with separately decoded buffers', function () {
      sent(sender, signature, 1n)
      acknowledge([[sender, Buffer.from(signature)]])
      acknowledge([[sender, Buffer.from(signature)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, [])
    })

    it('keeps newer pending signatures available after acknowledging an older one', function () {
      const newer = Buffer.alloc(256, 2)
      sent(sender, signature, 1n)
      sent(sender, newer, 2n)
      acknowledge([[sender, Buffer.from(signature)]])
      acknowledge([[sender, Buffer.from(newer)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, [])
    })

    it('rejects a signature that was never sent after a valid acknowledgement', function () {
      sent(sender, signature, 1n)
      acknowledge([[sender, Buffer.from(signature)]])
      acknowledge([[other, Buffer.alloc(256, 3)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('rejects a distinct signature whose UTF-8 property key would collide', function () {
      sent(sender, Buffer.alloc(256, 0x80), 1n)
      acknowledge([[sender, Buffer.alloc(256, 0x81)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('rejects a rejected signature whose UTF-8 property key would collide', function () {
      sent(sender, Buffer.alloc(256, 0x80), 1n)
      acknowledge([], { sender, signature: Buffer.alloc(256, 0x81) })
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('rejects acknowledgements in descending timestamp order', function () {
      sent(sender, signature, 2n)
      sent(other, Buffer.alloc(256, 2), 1n)
      acknowledge([[sender, Buffer.from(signature)], [other, Buffer.alloc(256, 2)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('rejects two last-seen entries from the same sender', function () {
      sent(sender, signature, 1n)
      sent(sender, Buffer.alloc(256, 2), 2n)
      acknowledge([[sender, Buffer.from(signature)], [sender, Buffer.alloc(256, 2)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('does not remove pending entries when an absent rejection fails validation', function () {
      sent(sender, signature, 1n)
      acknowledge([], { sender: other, signature: Buffer.alloc(256, 3) })
      acknowledge([[sender, Buffer.from(signature)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
    })

    it('keeps rejected signatures available without discarding newer pending messages', function () {
      const newer = Buffer.alloc(256, 2)
      sent(sender, signature, 1n)
      sent(sender, newer, 2n)
      acknowledge([], { sender, signature: Buffer.from(signature) })
      acknowledge([[sender, Buffer.from(signature)]])
      acknowledge([[sender, Buffer.from(newer)]])
      assert.deepStrictEqual(errors, [])
      assert.deepStrictEqual(ended, [])
    })
  })
}
