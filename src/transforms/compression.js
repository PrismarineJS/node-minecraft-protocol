'use strict'

const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')
const { promisify } = require('util')
const Transform = require('readable-stream').Transform

const compress = promisify(zlib.deflate)
const decompress = promisify(zlib.unzip)

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

  async _transform (chunk, enc, cb) {
    if (chunk.length >= this.compressionThreshold) {
      try {
        const newChunk = async compress(chunk)
        if (newChunk.length < 2097153) {
          const buf = Buffer.allocUnsafe(sizeOfVarInt(chunk.length) + newChunk.length)
          newChunk.copy(buf, writeVarInt(chunk.length, buf, 0))
          return cb(null, buf)
        }
      } catch (err) { return cb(err) }
    }
    const buf = Buffer.allocUnsafe(sizeOfVarInt(0) + chunk.length)
    chunk.copy(buf, writeVarInt(0, buf, 0))
    return cb(null, buf)
  }
}

class Decompressor extends Transform {
  constructor (compressionThreshold = -1, hideErrors = false) {
    super()
    this.compressionThreshold = compressionThreshold
    this.hideErrors = hideErrors
  }

  async _transform (chunk, enc, cb) {
    try {
      const { size, value } = readVarInt(chunk, 0)
      if (value === 0) {
        return cb(null, chunk.slice(size))
      }
      const newBuf = decompress(chunk.slice(size), { finishFlush: 2 /*  Z_SYNC_FLUSH = 2, but when using Browserify/Webpack it doesn't exist */ })
      if (newBuf.length !== value && !this.hideErrors) {
        throw new Error('uncompressed length should be ' + value + ' but is ' + newBuf.length)
      }
      return cb(null, newBuf)
    } catch (err) {
      if (!this.hideErrors) {
        console.error('problem inflating chunk')
        console.error('chunk length ' + chunk.length)
        console.error('hex ' + chunk.toString('hex'))
        console.log(err)
      }
      return cb(this.hideErrors ? null : err)
    }
  }
}
