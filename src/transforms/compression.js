'use strict'

const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')
const Transform = require('readable-stream').Transform

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
      zlib.deflate(chunk, (err, newChunk) => {
        if (err) { return cb(err) }
        const buf = Buffer.alloc(sizeOfVarInt(chunk.length) + newChunk.length)
        const offset = writeVarInt(chunk.length, buf, 0)
        newChunk.copy(buf, offset)
        this.push(buf)
        return cb()
      })
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
    } else {
      zlib.unzip(chunk.slice(size), { finishFlush: 2 /*  Z_SYNC_FLUSH = 2, but when using Browserify/Webpack it doesn't exist */ }, (err, newBuf) => { /** Fix by lefela4. */
        if (err) {
          if (!this.hideErrors) {
            console.error('problem inflating chunk')
            console.error('uncompressed length ' + value)
            console.error('compressed length ' + chunk.length)
            console.error('hex ' + chunk.toString('hex'))
            console.log(err)
          }
          return cb()
        }
        if (newBuf.length !== value && !this.hideErrors) {
          console.error('uncompressed length should be ' + value + ' but is ' + newBuf.length)
        }
        this.push(newBuf)
        return cb()
      })
    }
  }
}
