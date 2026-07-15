const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint

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
  const quantized = Math.min(Math.floor(packed / Math.pow(2, shift)) % 0x8000, MAX_QUANTIZED_VALUE)
  return (quantized * 2.0) / MAX_QUANTIZED_VALUE - 1.0
}

function readLpVec3 (buffer, offset) {
  const a = buffer[offset]
  if (a === 0) {
    return { value: { x: 0, y: 0, z: 0 }, size: 1 }
  }

  const b = buffer[offset + 1]
  const c = buffer.readUInt32BE(offset + 2)

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
  const needsContinuation = scale > 3
  const markers = needsContinuation ? ((scale % 4) | 4) : scale
  const packed = markers + pack(x / scale) * 0x8 + pack(y / scale) * 0x40000 + pack(z / scale) * 0x200000000

  buffer.writeUInt8(packed % 0x100, offset)
  buffer.writeUInt8(Math.floor(packed / 0x100) % 0x100, offset + 1)
  buffer.writeUInt32BE(Math.floor(packed / 0x10000) % 0x100000000, offset + 2)

  if (needsContinuation) {
    return writeVarInt(Math.floor(scale / 4), buffer, offset + 6)
  }

  return offset + 6
}

function sizeOfLpVec3 (value) {
  const max = Math.max(Math.abs(sanitize(value.x)), Math.abs(sanitize(value.y)), Math.abs(sanitize(value.z)))
  if (max < ABS_MIN_VALUE) return 1

  const scale = Math.ceil(max)
  if (scale > 3) {
    return 6 + sizeOfVarInt(Math.floor(scale / 4))
  }
  return 6
}

module.exports = [readLpVec3, writeLpVec3, sizeOfLpVec3]
