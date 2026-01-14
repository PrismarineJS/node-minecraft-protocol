const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint

// Adapted from https://github.com/extremeheat/extracted_minecraft_data/blob/client1.21.10/client/net/minecraft/network/LpVec3.java

const DATA_BITS_MASK = 32767
const MAX_QUANTIZED_VALUE = 32766.0
const SCALE_BITS = 2
const SCALE_BITS_MASK = 3
const CONTINUATION_FLAG = 4
const X_OFFSET = 3
const Y_OFFSET = 18
const Z_OFFSET = 33
const ABS_MAX_VALUE = 1.7179869183e10
const ABS_MIN_VALUE = 3.051944088384301e-5

function hasContinuationBit (a) {
  return (a & CONTINUATION_FLAG) === CONTINUATION_FLAG
}

function sanitize (value) {
  if (Number.isNaN(value)) return 0.0
  return Math.max(-ABS_MAX_VALUE, Math.min(value, ABS_MAX_VALUE))
}

function pack (value) {
  return BigInt(Math.round((value * 0.5 + 0.5) * MAX_QUANTIZED_VALUE))
}

function unpack (bits) {
  const masked = Number(bits & BigInt(DATA_BITS_MASK))
  const clamped = Math.min(masked, MAX_QUANTIZED_VALUE)
  return (clamped * 2.0) / MAX_QUANTIZED_VALUE - 1.0
}

function readLpVec3 (buffer, offset) {
  if (offset + 1 > buffer.length) throw new Error('Unexpected end while reading LpVec3')
  const a = buffer.readUInt8(offset)

  if (a === 0) {
    return { value: { x: 0, y: 0, z: 0 }, size: 1 }
  }

  if (offset + 6 > buffer.length) throw new Error('Unexpected end while reading LpVec3')
  const b = buffer.readUInt8(offset + 1)
  const c = buffer.readUInt32LE(offset + 2)

  const packed = (BigInt(c >>> 0) << 16n) | (BigInt(b & 0xff) << 8n) | BigInt(a & 0xff)

  let scale = BigInt(a & SCALE_BITS_MASK)
  let totalSize = 6

  if (hasContinuationBit(a)) {
    const dRes = readVarInt(buffer, offset + 6)
    scale |= (BigInt(dRes.value >>> 0) << BigInt(SCALE_BITS))
    totalSize = 6 + dRes.size
  }

  const x = unpack(packed >> BigInt(X_OFFSET)) * Number(scale)
  const y = unpack(packed >> BigInt(Y_OFFSET)) * Number(scale)
  const z = unpack(packed >> BigInt(Z_OFFSET)) * Number(scale)

  return { value: { x, y, z }, size: totalSize }
}

function writeLpVec3 (value, buffer, offset) {
  const x = sanitize(value.x)
  const y = sanitize(value.y)
  const z = sanitize(value.z)

  const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z))

  if (max < ABS_MIN_VALUE) {
    buffer.writeUInt8(0, offset)
    return offset + 1
  }

  const scale = BigInt(Math.ceil(max))
  const needsContinuation = (scale & BigInt(SCALE_BITS_MASK)) !== scale

  const scaleByte = needsContinuation ? ((scale & BigInt(SCALE_BITS_MASK)) | BigInt(CONTINUATION_FLAG)) : scale
  const scaleNum = Number(scale)

  const packedX = pack(x / scaleNum) << BigInt(X_OFFSET)
  const packedY = pack(y / scaleNum) << BigInt(Y_OFFSET)
  const packedZ = pack(z / scaleNum) << BigInt(Z_OFFSET)

  const packed = scaleByte | packedX | packedY | packedZ

  buffer.writeUInt8(Number(packed) & 0xff, offset)
  buffer.writeUInt8(Number((packed >> 8n) & 0xffn) & 0xff, offset + 1)
  buffer.writeUInt32LE(Number((packed >> 16n) & 0xffffffffn) >>> 0, offset + 2)

  if (needsContinuation) {
    return writeVarInt(Number(scale >> BigInt(SCALE_BITS)) >>> 0, buffer, offset + 6)
  }
  return offset + 6
}

function sizeOfLpVec3 (value) {
  const x = sanitize(value.x)
  const y = sanitize(value.y)
  const z = sanitize(value.z)

  const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z))

  if (max < ABS_MIN_VALUE) return 1

  const scale = BigInt(Math.ceil(max))
  const needsContinuation = (scale & BigInt(SCALE_BITS_MASK)) !== scale

  if (needsContinuation) {
    return 6 + sizeOfVarInt(Number(scale >> BigInt(SCALE_BITS)) >>> 0)
  }
  return 6
}

module.exports = [readLpVec3, writeLpVec3, sizeOfLpVec3]
