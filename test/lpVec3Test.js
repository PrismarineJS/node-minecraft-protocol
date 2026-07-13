/* eslint-env mocha */
const assert = require('assert')
const [readLpVec3, writeLpVec3, sizeOfLpVec3] = require('../src/datatypes/lpVec3')

// Velocity payloads captured from a real vanilla 1.21.11 server: the bytes of a
// ClientboundSetEntityMotionPacket after the entity-id varint (i.e. the LpVec3 itself).
const REAL_PAYLOADS = ['f9ff7ffeebed', '59e7800cebed', '51e880011541', '09e98000d8fd']

describe('lpVec3', () => {
  it('decodes the zero vector as a single byte', () => {
    const r = readLpVec3(Buffer.from('00', 'hex'), 0)
    assert.deepStrictEqual(r.value, { x: 0, y: 0, z: 0 })
    assert.strictEqual(r.size, 1)
  })

  it('encodes a near-zero vector as a single byte', () => {
    const buf = Buffer.alloc(8)
    const end = writeLpVec3({ x: 0, y: 0, z: 0 }, buf, 0)
    assert.strictEqual(end, 1)
    assert.strictEqual(buf[0], 0)
    assert.strictEqual(sizeOfLpVec3({ x: 0, y: 0, z: 0 }), 1)
  })

  it('decodes real 1.21.11 server velocity bytes to sane values', () => {
    // big-endian 32-bit word; value in blocks per tick (the codec's natural units)
    const r = readLpVec3(Buffer.from('f9ff7ffeebed', 'hex'), 0)
    assert.strictEqual(r.size, 6)
    assert.ok(Math.abs(r.value.y - (-0.0784)) < 0.001, 'unexpected y: ' + r.value.y)
    assert.ok(Math.abs(r.value.x) < 1 && Math.abs(r.value.z) < 1, 'velocity out of range')
  })

  it('round-trips real server velocity bytes exactly', () => {
    for (const hex of REAL_PAYLOADS) {
      const value = readLpVec3(Buffer.from(hex, 'hex'), 0).value
      const buf = Buffer.alloc(16)
      const end = writeLpVec3(value, buf, 0)
      assert.strictEqual(buf.subarray(0, end).toString('hex'), hex, 'round-trip mismatch for ' + hex)
      assert.strictEqual(sizeOfLpVec3(value), end, 'sizeOf mismatch for ' + hex)
    }
  })
})
