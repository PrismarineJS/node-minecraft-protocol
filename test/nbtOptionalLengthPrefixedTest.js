/* eslint-env mocha */
const assert = require('assert')
const nbt = require('prismarine-nbt')
const { nbtOptionalLengthPrefixed } = require('../src/datatypes/minecraft')
const [read, write, sizeOf] = nbtOptionalLengthPrefixed

describe('nbtOptionalLengthPrefixed', () => {
  // The NBT payload of a real ServerboundCustomClickActionPacket (a dialog form submit),
  // captured from a 1.21.11 client: a single VarInt byte-length (0x1a = 26) followed by the
  // anonymous compound { password: "hello world" }.
  const compound = nbt.comp({ password: nbt.string('hello world') })
  // 1a | 0a(compound) 08(string) 0008 "password" 000b "hello world" 00(end)
  const expectedHex = '1a' + '0a' + '08' + '0008' + Buffer.from('password').toString('hex') +
    '000b' + Buffer.from('hello world').toString('hex') + '00'

  it('writes a present tag as VarInt(byteLength) + anonymous NBT', () => {
    const buf = Buffer.alloc(sizeOf(compound))
    const end = write(compound, buf, 0)
    assert.strictEqual(buf.subarray(0, end).toString('hex'), expectedHex)
    assert.strictEqual(sizeOf(compound), end)
  })

  it('round-trips a present tag', () => {
    const buf = Buffer.alloc(sizeOf(compound))
    write(compound, buf, 0)
    const { value, size } = read(buf, 0)
    assert.strictEqual(size, buf.length)
    assert.strictEqual(value.value.password.value, 'hello world')
  })

  it('encodes an absent tag as 01 00 (length 1, TAG_END)', () => {
    const buf = Buffer.alloc(8)
    const end = write(undefined, buf, 0)
    assert.strictEqual(buf.subarray(0, end).toString('hex'), '0100')
    assert.strictEqual(sizeOf(undefined), 2)
    assert.strictEqual(read(buf, 0).value, undefined)
  })
})
