/* eslint-env mocha */
const assert = require('assert')
const [readLpVec3, writeLpVec3, sizeOfLpVec3] = require('../src/datatypes/lpVec3')

const REAL_PAYLOADS = ['f9ff7ffeebed', '59e7800cebed', '51e880011541', '09e98000d8fd']

// { x: scale, y: -scale, z: 0 } as a vanilla 26.3 server writes it: scale >> 2 at each var-int
// length, then either side of 2^31 and at ABS_MAX_VALUE, where it no longer fits a signed int.
const CONTINUED_SCALE_PAYLOADS = [
  [511, 'f7ff7ffe00037f'],
  [65535, 'f7ff7ffe0003ff7f'],
  [65536, 'f4ff7ffe0003808001'],
  [8388607, 'f7ff7ffe0003ffff7f'],
  [8388608, 'f4ff7ffe000380808001'],
  [1073741823, 'f7ff7ffe0003ffffff7f'],
  [1073741824, 'f4ff7ffe00038080808001'],
  [8589934591, 'f7ff7ffe0003ffffffff07'],
  [8589934592, 'f4ff7ffe00038080808008'],
  [17179869183, 'f7ff7ffe0003ffffffff0f']
]

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

  it('reads the continued scale as unsigned', () => {
    for (const [scale, hex] of CONTINUED_SCALE_PAYLOADS) {
      const result = readLpVec3(Buffer.from(hex, 'hex'), 0)
      assert.deepStrictEqual(result.value, { x: scale, y: -scale, z: 0 }, 'unexpected value for ' + hex)
      assert.strictEqual(result.size, hex.length / 2)
    }
  })

  it('writes the continued scale as vanilla does', () => {
    for (const [scale, hex] of CONTINUED_SCALE_PAYLOADS) {
      const value = { x: scale, y: -scale, z: 0 }
      const buffer = Buffer.alloc(sizeOfLpVec3(value))
      assert.strictEqual(writeLpVec3(value, buffer, 0), buffer.length, 'sizeOf and write disagree for ' + scale)
      assert.strictEqual(buffer.toString('hex'), hex)
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
