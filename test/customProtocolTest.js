/* eslint-env mocha */
const assert = require('assert')
const minecraftData = require('minecraft-data')

describe('custom protocol isolation', () => {
  let createSerializer
  const options = { version: '1.20.1', state: 'play', isServer: false }
  const custom = type => ({ '1.20': { types: { custom_probe: type } } })

  beforeEach(() => {
    delete require.cache[require.resolve('../src/transforms/serializer')]
    createSerializer = require('../src/transforms/serializer').createSerializer
  })
  afterEach(() => {
    delete minecraftData('1.20.1').protocol.types.custom_probe
  })

  it('does not merge custom types into shared minecraft-data', () => {
    const original = JSON.stringify(minecraftData('1.20.1').protocol)
    createSerializer({ ...options, customPackets: custom('u8') })
    assert.equal(JSON.stringify(minecraftData('1.20.1').protocol), original)
  })

  it('does not reuse a vanilla cache entry for custom packets', () => {
    const vanilla = createSerializer(options)
    const modified = createSerializer({ ...options, customPackets: custom('u16') })
    assert.notStrictEqual(modified.proto, vanilla.proto)
    assert.deepStrictEqual(modified.proto.createPacketBuffer('custom_probe', 0x1234), Buffer.from('1234', 'hex'))
  })

  it('isolates clients with different custom schemas', () => {
    const first = createSerializer({ ...options, customPackets: custom('u8') })
    const second = createSerializer({ ...options, customPackets: custom('u16') })
    assert.deepStrictEqual(first.proto.createPacketBuffer('custom_probe', 0x12), Buffer.from('12', 'hex'))
    assert.deepStrictEqual(second.proto.createPacketBuffer('custom_probe', 0x1234), Buffer.from('1234', 'hex'))
  })

  it('uses updated custom definitions while retaining the vanilla cache', () => {
    const definitions = custom('u8')
    const first = createSerializer({ ...options, customPackets: definitions })
    definitions['1.20'].types.custom_probe = 'u16'
    const second = createSerializer({ ...options, customPackets: definitions })
    assert.deepStrictEqual(first.proto.createPacketBuffer('custom_probe', 1), Buffer.from('01', 'hex'))
    assert.deepStrictEqual(second.proto.createPacketBuffer('custom_probe', 1), Buffer.from('0001', 'hex'))
    assert.strictEqual(createSerializer(options).proto, createSerializer(options).proto)
  })
})
