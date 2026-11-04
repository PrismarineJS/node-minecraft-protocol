'use strict'

const nbt = require('prismarine-nbt')
const UUID = require('uuid-1345')
const zlib = require('zlib')
const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const [readLpVec3, writeLpVec3, sizeOfLpVec3] = require('./lpVec3')

module.exports = {
  varlong: [readVarLong, writeVarLong, sizeOfVarLong],
  UUID: [readUUID, writeUUID, 16],
  compressedNbt: [readCompressedNbt, writeCompressedNbt, sizeOfCompressedNbt],
  restBuffer: [readRestBuffer, writeRestBuffer, sizeOfRestBuffer],
  entityMetadataLoop: [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
  topBitSetTerminatedArray: [readTopBitSetTerminatedArray, writeTopBitSetTerminatedArray, sizeOfTopBitSetTerminatedArray],
  lpVec3: [readLpVec3, writeLpVec3, sizeOfLpVec3],
  entityDelta: [readEntityDelta, writeEntityDelta, sizeOfEntityDelta]
}
const PartialReadError = require('protodef').utils.PartialReadError

// 26.3+ ClientboundMoveEntityPacket ("rel_entity_move" / "entity_move_look") delta encoding.
//
// Mojang replaced the old flat 3x-i16 delta with VecDelta, a packed `properties` varint
// (bit 0 = onGround, remaining bits = stepCount) followed by either:
//  - stepCount <= 0: the old flat format, 3x i16 (dX, dY, dZ) -- the common case when the
//    entity moved every tick, which is why this bug only shows up with several entities/ticks
//    skipped at once.
//  - stepCount > 0: `stepCount` DeltaStep entries, each read in wire order as
//    {ticks: varint, dX: i16, dY: i16, dZ: i16} -- these are chained deltas for smoother
//    client-side interpolation (each step's delta is relative to the position produced by
//    applying the previous step, not to the original base).
//
// Confirmed by decompiling VecDelta.read()/write() and ClientboundMoveEntityPacket's
// packProperties/unpackProperties/unpackStepCount in the real 26.3 server jar.
//
// Parsed shape (uniform regardless of wire variant so downstream code never has to branch):
//   { onGround: boolean, steps: [{ dX, dY, dZ, ticks }, ...] }
// For the flat/Linear wire format this is always a single-element array with ticks: 0.
function readEntityDelta (buffer, offset) {
  let cursor = offset
  const props = readVarInt(buffer, cursor)
  cursor += props.size
  const onGround = (props.value & 1) !== 0
  const stepCount = props.value >>> 1

  const steps = []
  if (stepCount <= 0) {
    if (cursor + 6 > buffer.length) throw new PartialReadError('Unexpected buffer end while reading entityDelta (linear)')
    steps.push({
      dX: buffer.readInt16BE(cursor),
      dY: buffer.readInt16BE(cursor + 2),
      dZ: buffer.readInt16BE(cursor + 4),
      ticks: 0
    })
    cursor += 6
  } else {
    for (let i = 0; i < stepCount; i++) {
      const ticksResult = readVarInt(buffer, cursor)
      cursor += ticksResult.size
      if (cursor + 6 > buffer.length) throw new PartialReadError('Unexpected buffer end while reading entityDelta (stepped)')
      steps.push({
        dX: buffer.readInt16BE(cursor),
        dY: buffer.readInt16BE(cursor + 2),
        dZ: buffer.readInt16BE(cursor + 4),
        ticks: ticksResult.value
      })
      cursor += 6
    }
  }

  return { value: { onGround, steps }, size: cursor - offset }
}

function writeEntityDelta (value, buffer, offset) {
  const { onGround, steps } = value
  const useLinear = steps.length === 1 && steps[0].ticks === 0
  const stepCount = useLinear ? 0 : steps.length
  const properties = (onGround ? 1 : 0) | (stepCount << 1)

  offset = writeVarInt(properties, buffer, offset)
  if (useLinear) {
    buffer.writeInt16BE(steps[0].dX, offset)
    buffer.writeInt16BE(steps[0].dY, offset + 2)
    buffer.writeInt16BE(steps[0].dZ, offset + 4)
    offset += 6
  } else {
    for (const step of steps) {
      offset = writeVarInt(step.ticks, buffer, offset)
      buffer.writeInt16BE(step.dX, offset)
      buffer.writeInt16BE(step.dY, offset + 2)
      buffer.writeInt16BE(step.dZ, offset + 4)
      offset += 6
    }
  }
  return offset
}

function sizeOfEntityDelta (value) {
  const { onGround, steps } = value
  const useLinear = steps.length === 1 && steps[0].ticks === 0
  const stepCount = useLinear ? 0 : steps.length
  const properties = (onGround ? 1 : 0) | (stepCount << 1)

  let size = sizeOfVarInt(properties)
  if (useLinear) {
    size += 6
  } else {
    for (const step of steps) {
      size += sizeOfVarInt(step.ticks) + 6
    }
  }
  return size
}

function readVarLong (buffer, offset) {
  return readVarInt(buffer, offset)
}

function writeVarLong (value, buffer, offset) {
  return writeVarInt(value, buffer, offset)
}

function sizeOfVarLong (value) {
  return sizeOfVarInt(value)
}

function readUUID (buffer, offset) {
  if (offset + 16 > buffer.length) { throw new PartialReadError() }
  return {
    value: UUID.stringify(buffer.slice(offset, 16 + offset)),
    size: 16
  }
}

function writeUUID (value, buffer, offset) {
  const buf = value.length === 32 ? Buffer.from(value, 'hex') : UUID.parse(value)
  buf.copy(buffer, offset)
  return offset + 16
}

function sizeOfNbt (value, { tagType } = { tagType: 'nbt' }) {
  return nbt.proto.sizeOf(value, tagType)
}

// Length-prefixed compressed NBT, see differences: http://wiki.vg/index.php?title=Slot_Data&diff=6056&oldid=4753
function readCompressedNbt (buffer, offset) {
  if (offset + 2 > buffer.length) { throw new PartialReadError() }
  const length = buffer.readInt16BE(offset)
  if (length === -1) return { size: 2 }
  if (offset + 2 + length > buffer.length) { throw new PartialReadError() }

  const compressedNbt = buffer.slice(offset + 2, offset + 2 + length)

  let nbtBuffer
  try {
    nbtBuffer = zlib.gunzipSync(compressedNbt) // TODO: async
  } catch (err) {
    throw new PartialReadError('zlib decompress failed: ' + err.message)
  }

  const results = nbt.proto.read(nbtBuffer, 0, 'nbt')
  return {
    size: length + 2,
    value: results.value
  }
}

function writeCompressedNbt (value, buffer, offset) {
  if (value === undefined) {
    buffer.writeInt16BE(-1, offset)
    return offset + 2
  }
  const nbtBuffer = Buffer.alloc(sizeOfNbt(value))
  nbt.proto.write(value, nbtBuffer, 0, 'nbt')

  const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async
  compressedNbt.writeUInt8(0, 9) // clear the OS field to match MC

  buffer.writeInt16BE(compressedNbt.length, offset)
  compressedNbt.copy(buffer, offset + 2)
  return offset + 2 + compressedNbt.length
}

function sizeOfCompressedNbt (value) {
  if (value === undefined) { return 2 }

  const nbtBuffer = Buffer.alloc(sizeOfNbt(value, { tagType: 'nbt' }))
  nbt.proto.write(value, nbtBuffer, 0, 'nbt')

  const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async

  return 2 + compressedNbt.length
}

function readRestBuffer (buffer, offset) {
  return {
    value: buffer.slice(offset),
    size: buffer.length - offset
  }
}

function writeRestBuffer (value, buffer, offset) {
  value.copy(buffer, offset)
  return offset + value.length
}

function sizeOfRestBuffer (value) {
  return value.length
}

function readEntityMetadata (buffer, offset, { type, endVal }) {
  let cursor = offset
  const metadata = []
  let item
  while (true) {
    if (offset + 1 > buffer.length) { throw new PartialReadError() }
    item = buffer.readUInt8(cursor)
    if (item === endVal) {
      return {
        value: metadata,
        size: cursor + 1 - offset
      }
    }
    const results = this.read(buffer, cursor, type, {})
    metadata.push(results.value)
    cursor += results.size
  }
}

function writeEntityMetadata (value, buffer, offset, { type, endVal }) {
  const self = this
  value.forEach(function (item) {
    offset = self.write(item, buffer, offset, type, {})
  })
  buffer.writeUInt8(endVal, offset)
  return offset + 1
}

function sizeOfEntityMetadata (value, { type }) {
  let size = 1
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}

function readTopBitSetTerminatedArray (buffer, offset, { type }) {
  let cursor = offset
  const values = []
  let item
  while (true) {
    if (offset + 1 > buffer.length) { throw new PartialReadError() }
    item = buffer.readUInt8(cursor)
    buffer[cursor] = buffer[cursor] & 127 // removes top bit
    const results = this.read(buffer, cursor, type, {})
    values.push(results.value)
    cursor += results.size
    if ((item & 128) === 0) { // check if top bit is set, if not last value
      return {
        value: values,
        size: cursor - offset
      }
    }
  }
}

function writeTopBitSetTerminatedArray (value, buffer, offset, { type }) {
  const self = this
  let prevOffset = offset
  value.forEach(function (item, i) {
    prevOffset = offset
    offset = self.write(item, buffer, offset, type, {})
    buffer[prevOffset] = i !== value.length - 1 ? (buffer[prevOffset] | 128) : buffer[prevOffset] // set top bit for all values but last
  })
  return offset
}

function sizeOfTopBitSetTerminatedArray (value, { type }) {
  let size = 0
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}
