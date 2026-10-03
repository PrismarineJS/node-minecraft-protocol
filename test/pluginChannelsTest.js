/* eslint-env mocha */

const EventEmitter = require('events')
const assert = require('power-assert')
const inject = require('../src/client/pluginChannels')

function makeClient () {
  const client = new EventEmitter()
  client.write = () => {}
  inject(client, { version: '1.21.4' })
  return client
}

describe('1.21.4v pluginChannels', () => {
  it('unregisterChannel removes the requested channel', () => {
    const client = makeClient()
    client.registerChannel('example:first')
    client.registerChannel('example:second')
    const received = []
    client.on('example:first', () => received.push('first'))
    client.on('example:second', () => received.push('second'))

    client.unregisterChannel('example:second')

    client.emit('custom_payload', { channel: 'example:first', data: Buffer.alloc(0) })
    client.emit('custom_payload', { channel: 'example:second', data: Buffer.alloc(0) })
    assert.deepStrictEqual(received, ['first'])
  })

  it('unregisterChannel removes a channel stored at index 0', () => {
    const client = makeClient()
    const received = []
    client.on('minecraft:register', () => received.push('builtin'))
    const payload = () => ({ channel: 'minecraft:register', data: Buffer.from('example:only') })
    client.emit('custom_payload', payload())
    assert.deepStrictEqual(received, ['builtin']) // prove dispatch before unregistering

    client.unregisterChannel('minecraft:register') // first built-in channel, at index 0
    client.emit('custom_payload', payload())
    assert.deepStrictEqual(received, ['builtin']) // no second delivery after removal
  })
})
