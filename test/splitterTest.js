/* eslint-env mocha */
const assert = require('assert')
const { createSplitter, createFramer } = require('../src/transforms/framing')

// The splitter reassembles length-prefixed packets from an arbitrarily chunked TCP stream. It must
// frame identically no matter how the bytes are delivered, including when a chunk boundary falls in
// the middle of a packet's length varint (the case the splitter must wait on rather than mis-frame).
describe('packet length splitter', () => {
  // packets exercising 1-, 2- and 3-byte length varints (a real packet always carries a packet id, so never 0-length)
  const sizes = [1, 5, 127, 128, 300, 16383, 16384, 20000, 2, 50]
  const packets = sizes.map((n, i) => Buffer.from(Array.from({ length: n }, (_, j) => (i * 31 + j) & 0xff)))

  function frameAll () {
    return new Promise(resolve => {
      const framer = createFramer(); const out = []
      framer.on('data', d => out.push(d))
      framer.on('end', () => resolve(Buffer.concat(out)))
      for (const p of packets) framer.write(p)
      framer.end()
    })
  }

  function split (stream, chunker) {
    return new Promise(resolve => {
      const sp = createSplitter(); const got = []
      sp.on('data', d => got.push(Buffer.from(d)))
      sp.on('end', () => resolve(got))
      for (const c of chunker(stream)) sp.write(c)
      sp.end()
    })
  }

  const chunkers = {
    'whole stream at once': s => [s],
    'one byte at a time': s => Array.from({ length: s.length }, (_, i) => s.slice(i, i + 1)),
    'fixed 3-byte chunks': s => { const a = []; for (let i = 0; i < s.length; i += 3) a.push(s.slice(i, i + 3)); return a },
    'pseudo-random chunks': s => { const a = []; let i = 0; let seed = 12345; while (i < s.length) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = 1 + (seed % 7); a.push(s.slice(i, i + n)); i += n } return a }
  }

  for (const [name, chunker] of Object.entries(chunkers)) {
    it(`reassembles every packet when the stream arrives as ${name}`, async () => {
      const got = await split(await frameAll(), chunker)
      assert.strictEqual(got.length, packets.length, `expected ${packets.length} packets, got ${got.length}`)
      for (let i = 0; i < packets.length; i++) {
        assert.ok(got[i].equals(packets[i]), `packet ${i} (len ${packets[i].length}) was not reassembled correctly`)
      }
    })
  }
})
