/* eslint-env mocha */
// Tests the compression transforms, in particular that the decompressor enforces the
// protocol's maximum uncompressed packet size so a malicious peer cannot send a
// "decompression bomb" that inflates to an unbounded synchronous allocation. See #664.
const assert = require('assert')
const zlib = require('zlib')
const [, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const { supportedVersions } = require('../src/version')
const { createCompressor, createDecompressor } = require('../src/transforms/compression')

const MAX_UNCOMPRESSED_LENGTH = 8388608 // 2 ** 23

// Push a single chunk through a transform and resolve with the array of emitted chunks.
function pump (transform, chunk) {
  return new Promise((resolve, reject) => {
    const out = []
    transform.on('data', (d) => out.push(d))
    transform.on('error', reject)
    transform.write(chunk, (err) => {
      if (err) return reject(err)
      setImmediate(() => resolve(out))
    })
  })
}

// Build a compressed-packet frame: a VarInt declared uncompressed length followed by `payload`.
function framePacket (declaredLength, payload) {
  const header = Buffer.alloc(sizeOfVarInt(declaredLength))
  writeVarInt(declaredLength, header, 0)
  return Buffer.concat([header, payload])
}

// The transforms are version-independent, but the test job filters by `-g <version>v`,
// so the suite is registered per supported version to run under CI.
for (const supportedVersion of supportedVersions) {
  describe('compression ' + supportedVersion + 'v', () => {
    it('round-trips a compressed packet', async () => {
      const original = Buffer.from('a payload long enough to be worth compressing'.repeat(8))
      const [compressed] = await pump(createCompressor(0), original)
      const [restored] = await pump(createDecompressor(0), compressed)
      assert.ok(restored.equals(original), 'decompressed output should equal the original')
    })

    it('passes through an uncompressed packet (declared length 0)', async () => {
      const original = Buffer.from('small')
      // threshold above the payload size -> compressor emits it uncompressed (VarInt 0 prefix)
      const [framed] = await pump(createCompressor(256), original)
      const [restored] = await pump(createDecompressor(256), framed)
      assert.ok(restored.equals(original))
    })

    it('drops a decompression bomb instead of allocating past the maximum', async () => {
      // Payload inflates to more than the protocol maximum, but declares a small length.
      const bomb = zlib.deflateSync(Buffer.alloc(MAX_UNCOMPRESSED_LENGTH + 1024))
      const packet = framePacket(100, bomb)
      const out = await pump(createDecompressor(0, true), packet)
      assert.strictEqual(out.length, 0, 'oversized inflate should be dropped, not emitted')
    })

    it('rejects a packet whose declared uncompressed length exceeds the maximum', async () => {
      const packet = framePacket(MAX_UNCOMPRESSED_LENGTH + 1, zlib.deflateSync(Buffer.from('x')))
      const out = await pump(createDecompressor(0, true), packet)
      assert.strictEqual(out.length, 0, 'over-cap declared length should be dropped before inflating')
    })

    it('round-trips a packet at the maximum uncompressed length', async () => {
      const original = Buffer.alloc(MAX_UNCOMPRESSED_LENGTH, 0)
      const [compressed] = await pump(createCompressor(0), original)
      const [restored] = await pump(createDecompressor(0), compressed)
      assert.ok(restored.equals(original))
    })
  })
}
