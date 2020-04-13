const { ProtoDef } = require('protodef-neo/legacy.cjs')
const proto = new ProtoDef({ types: { varint: 'native' } })
const zlib = require('zlib')
const Transform = require('readable-stream').Transform
const finishFlush = zlib.constants.Z_SYNC_FLUSH // Fix by lefela4.

module.exports.createCompressor = function (threshold) {
  return new Compressor(threshold)
}

module.exports.createDecompressor = function (threshold, hideErrors) {
  return new Decompressor(threshold, hideErrors)
}

class Compressor extends Transform {
  constructor (compressionThreshold = -1) {
    super()
    this.compressionThreshold = compressionThreshold !== -1
      ? Math.max(compressionThreshold | 0, 64)
      : Infinity
  }

  _transform (chunk, _, cb) {
    if (chunk.length > this.compressionThreshold) {
      zlib.deflate(chunk, (err, newChunk) => {
        cb(err, err || Buffer.concat([
          proto.createPacketBuffer('varint', chunk.length),
          newChunk
        ]))
      })
      return
    }
    cb(null, Buffer.concat([
      proto.createPacketBuffer('varint', 0),
      chunk
    ]))
  }
}

class Decompressor extends Transform {
  constructor (compressionThreshold = -1, hideErrors = false) {
    super()
    this.enabled = compressionThreshold !== -1
    this.compressionThreshold = compressionThreshold
    this.hideErrors = hideErrors
  }

  _transform (chunk, _, cb) {
    const { size, value } = proto.read(chunk, 0, 'varint')
    if (value === 0) {
      cb(null, chunk.slice(size))
      return
    }
    zlib.unzip(chunk.slice(size), { finishFlush }, (err, newBuf) => {
      if (err) {
        if (!this.hideErrors) {
          console.error('problem inflating chunk\n')
          console.error(`length uncompressed ${value} / compressed ${chunk.length}`)
          console.error('hex content -', chunk.inspect())
          console.log(err)
        }
        return cb()
      }
      if (newBuf.length !== value && !this.hideErrors) {
        console.error(`uncompressed length should be ${value} but is ${newBuf.length}`)
      }
      return cb(null, newBuf)
    })
  }
}
