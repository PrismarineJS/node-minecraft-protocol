/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const inject = require('../src/client/pluginChannels')
const { supportedVersions } = require('../src/version')

for (const version of supportedVersions) {
  describe(`${version}v plugin channel removal`, function () {
    let client
    const modern = require('minecraft-data')(version).version.version >= 385
    const register = modern ? 'minecraft:register' : 'REGISTER'
    const unregister = modern ? 'minecraft:unregister' : 'UNREGISTER'

    beforeEach(function () {
      client = new EventEmitter()
      client.write = () => {}
      inject(client, { version })
    })

    function deliveryCount (channel) {
      let count = 0
      client.on(channel, () => count++)
      return () => {
        client.emit('custom_payload', { channel, data: Buffer.alloc(0) })
        return count
      }
    }

    it('removes the requested channel without removing other channels', function () {
      client.registerChannel('example:first')
      client.registerChannel('example:second')
      const first = deliveryCount('example:first')
      const second = deliveryCount('example:second')
      const builtin = deliveryCount(register)
      assert.strictEqual(second(), 1)
      client.unregisterChannel('example:second')
      assert.strictEqual(second(), 1)
      assert.strictEqual(first(), 1)
      assert.strictEqual(builtin(), 1)
    })

    it('removes a channel at index zero', function () {
      const receive = deliveryCount(register)
      assert.strictEqual(receive(), 1)
      client.unregisterChannel(register)
      assert.strictEqual(receive(), 1)
    })

    it('leaves registered channels active when the name is absent', function () {
      const receive = deliveryCount(register)
      client.unregisterChannel('example:absent')
      assert.strictEqual(receive(), 1)
    })

    it('removes the payload handler when the last channel is removed', function () {
      client.unregisterChannel(register)
      client.unregisterChannel(unregister)
      assert.strictEqual(client.listenerCount('custom_payload'), 0)
    })
  })
}
