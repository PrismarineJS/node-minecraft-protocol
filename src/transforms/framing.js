'use strict'

const [, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const Transform = require('readable-stream').Transform

// Decode the packet-length varint without throwing when the buffer doesn't hold a complete one yet.
// The splitter hits that on nearly every TCP segment (a packet spread across reads), and protodef's
// readVarInt signals it by throwing a PartialReadError whose constructor captures a stack trace each
// time, which showed up as a top CPU cost under load. Returns null when more bytes are needed, matching
// the old "wait for more" behaviour (including an over-long length, which the previous code also waited on).
function tryReadVarInt (buffer, offset) {
  let value = 0
  let shift = 0
  let cursor = offset
  while (cursor < buffer.length) {
    const byte = buffer[cursor++]
    value |= (byte & 0x7f) << shift
    if (!(byte & 0x80)) return { value: value >>> 0, size: cursor - offset }
    shift += 7
    if (shift >= 35) return null // varint too long to be a valid 32-bit length
  }
  return null // incomplete: need more bytes
}

module.exports.createSplitter = function () {
  return new Splitter()
}

module.exports.createFramer = function () {
  return new Framer()
}

class Framer extends Transform {
  _transform (chunk, enc, cb) {
    const varIntSize = sizeOfVarInt(chunk.length)
    const buffer = Buffer.alloc(varIntSize + chunk.length)
    writeVarInt(chunk.length, buffer, 0)
    chunk.copy(buffer, varIntSize)
    this.push(buffer)
    return cb()
  }
}

const LEGACY_PING_PACKET_ID = 0xfe

class Splitter extends Transform {
  constructor () {
    super()
    this.buffer = Buffer.alloc(0)
    this.recognizeLegacyPing = false
  }

  _transform (chunk, enc, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk])

    if (this.recognizeLegacyPing && this.buffer[0] === LEGACY_PING_PACKET_ID) {
      // legacy_server_list_ping packet follows a different protocol format
      // prefix the encoded varint packet id for the deserializer
      const header = Buffer.alloc(sizeOfVarInt(LEGACY_PING_PACKET_ID))
      writeVarInt(LEGACY_PING_PACKET_ID, header, 0)
      let payload = this.buffer.slice(1) // remove 0xfe packet id
      if (payload.length === 0) payload = Buffer.from('\0') // TODO: update minecraft-data to recognize a lone 0xfe, https://github.com/PrismarineJS/minecraft-data/issues/95
      this.push(Buffer.concat([header, payload]))
      return cb()
    }

    let offset = 0
    let decoded = tryReadVarInt(this.buffer, offset)
    while (decoded !== null && this.buffer.length >= offset + decoded.size + decoded.value) {
      this.push(this.buffer.slice(offset + decoded.size, offset + decoded.size + decoded.value))
      offset += decoded.size + decoded.value
      decoded = tryReadVarInt(this.buffer, offset)
    }
    this.buffer = this.buffer.slice(offset)
    return cb()
  }
}
