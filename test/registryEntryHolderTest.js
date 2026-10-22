/* eslint-env mocha */
const assert = require('assert')
const { createSerializer, createDeserializer } = require('../src/transforms/serializer')

// A consumable component with an inline sound event: holder id 0 followed by the event.
const version = '1.21.4'
const sword = {
  itemCount: 1,
  itemId: 854,
  addedComponentCount: 1,
  removedComponentCount: 0,
  components: [{
    type: 'consumable',
    data: {
      consume_seconds: 3600,
      animation: 'block',
      sound: { data: { soundName: 'minecraft:intentionally_empty', fixedRange: undefined } },
      makes_particles: false,
      effects: []
    }
  }],
  removeComponents: []
}

describe('registryEntryHolder', () => {
  const serializer = createSerializer({ state: 'play', isServer: false, version })
  const deserializer = createDeserializer({ state: 'play', isServer: false, version })

  // The buffer is 0xff-filled: a byte the writer skips stays 0xff.
  function write (value) {
    const buffer = Buffer.alloc(serializer.proto.sizeOf(value, 'Slot'), 0xff)
    const end = serializer.proto.write(value, buffer, 0, 'Slot')
    assert.strictEqual(end, buffer.length, 'sizeOf and write disagree')
    return buffer
  }

  it('writes the 0 holder id in front of an inline entry', () => {
    const buffer = write(sword)
    // count, item id, added, removed, component type, consume_seconds (f32), animation, then the holder id
    const holderIdOffset = 1 + 2 + 1 + 1 + 1 + 4 + 1
    assert.strictEqual(buffer[holderIdOffset], 0, 'holder id byte: ' + buffer.toString('hex'))
  })

  it('round-trips an inline entry', () => {
    const buffer = write(sword)
    const parsed = deserializer.proto.parsePacketBuffer('Slot', buffer)
    assert.strictEqual(parsed.metadata.size, buffer.length)
    assert.deepStrictEqual(parsed.data.components[0].data.sound, { data: { soundName: 'minecraft:intentionally_empty', fixedRange: undefined } })
  })

  it('writes id + 1 for a registry entry', () => {
    const registry = { ...sword, components: [{ type: 'consumable', data: { ...sword.components[0].data, sound: { soundId: 5 } } }] }
    const buffer = write(registry)
    assert.strictEqual(buffer[1 + 2 + 1 + 1 + 1 + 4 + 1], 6)
    assert.deepStrictEqual(deserializer.proto.parsePacketBuffer('Slot', buffer).data.components[0].data.sound, { soundId: 5 })
  })
})
