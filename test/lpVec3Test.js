/* eslint-env mocha */
const assert = require('assert')
const [readLpVec3, writeLpVec3, sizeOfLpVec3] = require('../src/datatypes/lpVec3')

const REAL_PAYLOADS = ['f9ff7ffeebed', '59e7800cebed', '51e880011541', '09e98000d8fd']

describe('lpVec3', () => {
  it('decodes the zero vector as a single byte', () => {
    const result = readLpVec3(Buffer.from('00', 'hex'), 0)
    assert.deepStrictEqual(result.value, { x: 0, y: 0, z: 0 })
    assert.strictEqual(result.size, 1)
  })

  it('decodes real 1.21.11 server velocity bytes in blocks per tick', () => {
    const result = readLpVec3(Buffer.from('f9ff7ffeebed', 'hex'), 0)
    assert.strictEqual(result.size, 6)
    assert.ok(Math.abs(result.value.y - (-0.0784)) < 0.001, 'unexpected y: ' + result.value.y)
    assert.ok(Math.abs(result.value.x) < 1 && Math.abs(result.value.z) < 1, 'velocity out of range')
  })

  it('round-trips real server velocity bytes exactly', () => {
    for (const hex of REAL_PAYLOADS) {
      const value = readLpVec3(Buffer.from(hex, 'hex'), 0).value
      const buffer = Buffer.alloc(16)
      const end = writeLpVec3(value, buffer, 0)
      assert.strictEqual(buffer.subarray(0, end).toString('hex'), hex, 'round-trip mismatch for ' + hex)
      assert.strictEqual(sizeOfLpVec3(value), end, 'sizeOf mismatch for ' + hex)
    }
  })

  it('sizes sanitized values consistently', () => {
    for (const x of [NaN, Infinity]) {
      const value = { x, y: 0, z: 0 }
      const size = sizeOfLpVec3(value)
      assert.strictEqual(writeLpVec3(value, Buffer.alloc(size), 0), size)
    }
  })
})
