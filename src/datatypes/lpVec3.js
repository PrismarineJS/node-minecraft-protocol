const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint

const DATA_BITS_MASK = 32767
const MAX_QUANTIZED_VALUE = 32766.0
const ABS_MIN_VALUE = 3.051944088384301e-5
const ABS_MAX_VALUE = 1.7179869183e10

function sanitize (value) {
  if (isNaN(value)) return 0.0
  return Math.max(-ABS_MAX_VALUE, Math.min(value, ABS_MAX_VALUE))
}

function pack (value) {
  return Math.round((value * 0.5 + 0.5) * MAX_QUANTIZED_VALUE)
}

function unpack (packed, shift) {
  // We use division by power of 2 to simulate a 64-bit right shift
  const val = Math.floor(packed / Math.pow(2, shift)) & DATA_BITS_MASK
  const clamped = val > 32766 ? 32766 : val
  return (clamped * 2.0) / 32766.0 - 1.0
}

function readLpVec3 (buffer, offset) {
  const a = buffer[offset]
  if (a === 0) {
    return { value: { x: 0, y: 0, z: 0 }, size: 1 }
  }

  const b = buffer[offset + 1]
  const c = buffer.readUInt32LE(offset + 2)

  // Combine into 48-bit safe integer (up to 2^53 is safe in JS)
  const packed = (c * 65536) + (b << 8) + a

  let scale = a & 3
  let size = 6

  if ((a & 4) === 4) {
    const { value: varIntVal, size: varIntSize } = readVarInt(buffer, offset + 6)
    scale = (varIntVal * 4) + scale
    size += varIntSize
  }

  return {
    value: {
      x: unpack(packed, 3) * scale,
      y: unpack(packed, 18) * scale,
      z: unpack(packed, 33) * scale
    },
    size
  }
}

function writeLpVec3 (value, buffer, offset) {
  const x = sanitize(value.x)
  const y = sanitize(value.y)
  const z = sanitize(value.z)

  const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z))

  if (max < ABS_MIN_VALUE) {
    buffer[offset] = 0
    return offset + 1
  }

  const scale = Math.ceil(max)
  const needsContinuation = (scale & 3) !== scale
  const scaleByte = needsContinuation ? ((scale & 3) | 4) : (scale & 3)

  const pX = pack(x / scale)
  const pY = pack(y / scale)
  const pZ = pack(z / scale)

  // Layout:
  // [Z (15)] [Y (15)] [X (15)] [Flags (3)]

  // low32 contains Flags(3), X(15), and the first 14 bits of Y (3+15+14 = 32)
  const low32 = (scaleByte | (pX << 3) | (pY << 18)) >>> 0

  // high16 contains the 15th bit of Y and all 15 bits of Z
  const high16 = ((pY >> 14) & 0x01) | (pZ << 1)

  buffer.writeUInt32LE(low32, offset)
  buffer.writeUInt16LE(high16, offset + 4)

  if (needsContinuation) {
    return writeVarInt(Math.floor(scale / 4), buffer, offset + 6)
  }

  return offset + 6
}

function sizeOfLpVec3 (value) {
  const max = Math.max(Math.abs(value.x), Math.abs(value.y), Math.abs(value.z))
  if (max < ABS_MIN_VALUE) return 1

  const scale = Math.ceil(max)
  if ((scale & 3) !== scale) {
    return 6 + sizeOfVarInt(Math.floor(scale / 4))
  }
  return 6
}

module.exports = [readLpVec3, writeLpVec3, sizeOfLpVec3]
