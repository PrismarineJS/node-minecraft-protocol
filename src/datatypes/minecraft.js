const nbt = require('prismarine-nbt')
const UUID = require('uuid-1345')
const zlib = require('zlib')
const {
  ComplexDatatype,
  CountableDatatype,
  PartialReadError
} = require('protodef-neo')

class _UUID {
  read (buf) { return UUID.stringify(buf.slice(0, 16)) }
  write (buf, val) { UUID.parse(val).copy(buf) }
  sizeRead (buf) {
    if (buf.length < 16) { throw new PartialReadError() }
    return 16
  }

  sizeWrite () { return 16 }
}

class _nbt {
  read (buf) { return nbt.proto.read(buf, 0, 'nbt').value }
  write (buf, val) { return nbt.proto.write(val, buf, 0, 'nbt') }
  sizeRead (buf) { return nbt.proto.read(buf, 0, 'nbt').size }
  sizeWrite (val) { return nbt.proto.sizeOf(val, 'nbt') }
}

// Length-prefixed compressed NBT, see differences: http://wiki.vg/index.php?title=Slot_Data&diff=6056&oldid=4753
class compressedNbt extends CountableDatatype {
  constructor ({ type, ...count }, context) {
    super(count, context)
    this.type = this.constructDatatype(type)
  }

  read (buf) {
    const size = this.sizeReadCount(buf)
    const length = this.readCount(buf)
    if (length === -1) return undefined
    return this.type.read(zlib.gunzipSync(buf.slice(size, length + size)))
  }

  write (buf, val) {
    if (val === undefined) return this.writeCount(buf, -1)
    const nbtBuffer = Buffer.alloc(this.type.sizeWrite(val))
    this.type.write(nbtBuffer, val)
    const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async
    compressedNbt.writeUInt8(0, 9) // clear the OS field to match MC
    this.writeCount(buf, compressedNbt.length)
    compressedNbt.copy(buf, this.sizeWriteCount(compressedNbt.length))
  }

  sizeRead (buf) {
    const prefixSize = this.sizeReadCount(buf)
    if (buf.length < prefixSize) { throw new PartialReadError() }
    const length = this.readCount(buf)
    if (length === -1) return prefixSize
    if (buf.length < length + prefixSize) { throw new PartialReadError() }
    return length + prefixSize
  }

  sizeWrite (val) {
    if (val === undefined) return this.sizeWriteCount(-1)
    const nbtBuffer = Buffer.alloc(this.type.sizeWrite(val))
    this.type.write(nbtBuffer, val)
    const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async
    return this.sizeWriteCount(compressedNbt.length) + compressedNbt.length
  }
}

class entityMetadataLoop extends ComplexDatatype {
  constructor ({ type, endVal }, context) {
    super(context)
    this.type = this.constructDatatype(type)
    this.endVal = endVal
  }

  read (buf) {
    let i = 0
    const res = []
    while (true) {
      if (buf[i] === this.endVal) return res
      const view = buf.slice(i)
      i += this.type.sizeRead(view)
      res.push(this.type.read(view))
    }
  }

  write (buf, val) {
    let b = 0
    for (let i = 0, l = val.length; i < l; i++) {
      this.type.write(buf.slice(b), val[i])
      b += this.type.sizeWrite(val[i])
    }
    buf[b] = this.endVal
  }

  sizeRead (buf) {
    let i = 0
    while (true) {
      if (buf.length < i) { throw new PartialReadError() }
      if (buf[i] === this.endVal) return i + 1
      i += this.type.sizeRead(buf.slice(i))
    }
  }

  sizeWrite (val) {
    let size = 1
    for (let i = 0, l = val.length; i < l; i++) {
      size += this.type.sizeWrite(val[i])
    }
    return size
  }
}

module.exports = {
  UUID: _UUID,
  nbt: _nbt,
  optionalNbt: ['option', _nbt],
  compressedNbt: [compressedNbt, { countType: 'i16', type: _nbt }],
  restBuffer: ['buffer', { rest: true }],
  entityMetadataLoop
}
