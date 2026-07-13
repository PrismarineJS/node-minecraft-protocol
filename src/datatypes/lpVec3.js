const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint

// LpVec3 (net.minecraft.network.LpVec3) — the variable-length "low precision" vector
// used to encode entity velocity since 1.21.9. A leading 0 byte encodes the zero vector;
// otherwise it is 1 + 1 + 4 bytes that pack three 15-bit quantized components plus a 2-bit
// scale, with an optional trailing varint when the scale needs more than 2 bits.
//
// Wire format (matching FriendlyByteBuf): byte `a`, byte `b`, then a 32-bit `c` read/written
// BIG-endian via readUnsignedInt/writeInt. The 48-bit value is `c << 16 | b << 8 | a`.
//
// The decoded vector is in blocks per tick — the codec's natural units. Older versions encode
// velocity as vec3i16 in 1/8000-block-per-tick "notch" units; normalizing between the two forms
// is a version-specific consumer concern (mineflayer gates it with a supportFeature), not
// something this wire codec should bake in.
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

// extract the 15-bit quantized component at the given bit offset and map it back to [-1, 1].
// Uses division + modulo because the packed value can exceed 2^32 (JS bitwise ops are 32-bit).
function unpack (packed, shift) {
  const q = Math.min(Math.floor(packed / Math.pow(2, shift)) % 0x8000, MAX_QUANTIZED_VALUE)
  return (q * 2.0) / MAX_QUANTIZED_VALUE - 1.0
}

function readLpVec3 (buffer, offset) {
  const a = buffer[offset]
  if (a === 0) {
    return { value: { x: 0, y: 0, z: 0 }, size: 1 }
  }

  const b = buffer[offset + 1]
  const c = buffer.readUInt32BE(offset + 2) // big-endian (FriendlyByteBuf.readUnsignedInt)

  // combine into a 48-bit value; below 2^48 so it is exact as a JS double
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

  const chessboard = Math.max(Math.abs(x), Math.abs(y), Math.abs(z))
  if (chessboard < ABS_MIN_VALUE) {
    buffer.writeUInt8(0, offset)
    return offset + 1
  }

  const scale = Math.ceil(chessboard)
  const needsContinuation = scale > 3
  const markers = needsContinuation ? ((scale % 4) | 4) : scale

  // packed = markers | (xq << 3) | (yq << 18) | (zq << 33)
  const packed = markers + pack(x / scale) * 0x8 + pack(y / scale) * 0x40000 + pack(z / scale) * 0x200000000

  buffer.writeUInt8(packed % 0x100, offset)
  buffer.writeUInt8(Math.floor(packed / 0x100) % 0x100, offset + 1)
  buffer.writeUInt32BE(Math.floor(packed / 0x10000) % 0x100000000, offset + 2) // big-endian

  if (needsContinuation) {
    return writeVarInt(Math.floor(scale / 4), buffer, offset + 6)
  }
  return offset + 6
}

function sizeOfLpVec3 (value) {
  const chessboard = Math.max(Math.abs(value.x), Math.abs(value.y), Math.abs(value.z))
  if (chessboard < ABS_MIN_VALUE) return 1
  const scale = Math.ceil(chessboard)
  if (scale > 3) return 6 + sizeOfVarInt(Math.floor(scale / 4))
  return 6
}

module.exports = [readLpVec3, writeLpVec3, sizeOfLpVec3]
