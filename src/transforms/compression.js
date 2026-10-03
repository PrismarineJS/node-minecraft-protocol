'use strict'

const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')
const Transform = require('readable-stream').Transform

// The protocol caps the uncompressed size of a packet at 2^23 bytes (8 MiB). A compressed
// packet that declares — or inflates to — more than this is rejected, so a malicious peer
// cannot force an unbounded synchronous allocation (a "decompression bomb"). See #664.
const MAX_UNCOMPRESSED_LENGTH = 8388608 // 2 ** 23

module.exports.createCompressor = function (threshold) {
  return new Compressor(threshold)
}

module.exports.createDecompressor = function (threshold, hideErrors) {
  return new Decompressor(threshold, hideErrors)
}

class Compressor extends Transform {
  constructor (compressionThreshold = -1) {
    super()
    this.compressionThreshold = compressionThreshold
  }

  _transform (chunk, enc, cb) {
    if (chunk.length >= this.compressionThreshold) {
      try {
        const newChunk = zlib.deflateSync(chunk)
        const buf = Buffer.alloc(sizeOfVarInt(chunk.length) + newChunk.length)
        const offset = writeVarInt(chunk.length, buf, 0)
        newChunk.copy(buf, offset)
        this.push(buf)
        return cb()
      } catch (err) {
        return cb(err)
      }
    } else {
      const buf = Buffer.alloc(sizeOfVarInt(0) + chunk.length)
      const offset = writeVarInt(0, buf, 0)
      chunk.copy(buf, offset)
      this.push(buf)
      return cb()
    }
  }
}

class Decompressor extends Transform {
  constructor (compressionThreshold = -1, hideErrors = false) {
    super()
    this.compressionThreshold = compressionThreshold
    this.hideErrors = hideErrors
  }

  _transform (chunk, enc, cb) {
    const { size, value, error } = readVarInt(chunk, 0)
    if (error) { return cb(error) }
    if (value === 0) {
      this.push(chunk.slice(size))
      return cb()
    } else if (value > MAX_UNCOMPRESSED_LENGTH) {
      // Declared uncompressed length exceeds the protocol maximum; refuse to inflate.
      if (!this.hideErrors) {
        console.error('uncompressed length ' + value + ' exceeds maximum of ' + MAX_UNCOMPRESSED_LENGTH)
      }
      return cb()
    } else {
      try {
        const newBuf = zlib.unzipSync(chunk.slice(size), { maxOutputLength: MAX_UNCOMPRESSED_LENGTH, finishFlush: 2 })
        if (newBuf.length !== value && !this.hideErrors) {
          console.error('uncompressed length should be ' + value + ' but is ' + newBuf.length)
        }
        this.push(newBuf)
        return cb()
      } catch (err) {
        if (!this.hideErrors) {
          console.error('problem inflating chunk')
          console.error('uncompressed length ' + value)
          console.error('compressed length ' + chunk.length)
          console.error('hex ' + chunk.toString('hex'))
          console.log(err)
        }
        return cb()
      }
    }
  }
}
