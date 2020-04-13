const { ProtoDef } = require('protodef-neo/legacy.cjs')
const proto = new ProtoDef({ types: { varint: 'native' } })
const Transform = require('readable-stream').Transform

module.exports.createSplitter = function () {
  return new Splitter()
}

module.exports.createFramer = function () {
  return new Framer()
}

class Framer extends Transform {
  _transform (chunk, _, cb) {
    cb(null, Buffer.concat([
      proto.createPacketBuffer('varint', chunk.length),
      chunk
    ]))
  }
}

const LEGACY_PING_PACKET_ID = 0xfe

class Splitter extends Transform {
  constructor () {
    super()
    this.buffer = Buffer.alloc(0)
    this.recognizeLegacyPing = false
  }

  _transform (chunk, _, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk])

    if (this.recognizeLegacyPing && this.buffer[0] === LEGACY_PING_PACKET_ID) {
      // legacy_server_list_ping packet follows a different protocol format
      // prefix the encoded varint packet id for the deserializer
      // TODO: update minecraft-data to recognize a lone 0xfe
      // https://github.com/PrismarineJS/minecraft-data/issues/95
      cb(null, Buffer.concat([
        proto.createPacketBuffer('varint', LEGACY_PING_PACKET_ID),
        this.buffer.length > 1
          ? this.buffer.slice(1) // remove 0xfe packet id
          : Buffer.from([0])
      ]))
      return
    }

    let value, size
    try {
      ({ value, size } = proto.read(this.buffer, 0, 'varint'))
    } catch (e) {
      if (e.partialReadError) return cb()
      throw e
    }
    let offset = 0
    while (this.buffer.length >= offset + size + value) {
      try {
        this.push(this.buffer.slice(offset + size, offset + size + value))
        offset += size + value;
        ({ value, size } = proto.read(this.buffer, offset, 'varint'))
      } catch (e) {
        if (e.partialReadError) { break } else throw e
      }
    }
    this.buffer = this.buffer.slice(offset)
    return cb()
  }
}
