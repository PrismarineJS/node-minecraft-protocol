const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint

const DELTA_SIZE = 6

function readDelta (buffer, offset) {
  return {
    dX: buffer.readInt16BE(offset),
    dY: buffer.readInt16BE(offset + 2),
    dZ: buffer.readInt16BE(offset + 4)
  }
}

function writeDelta ({ dX, dY, dZ }, buffer, offset) {
  buffer.writeInt16BE(dX, offset)
  buffer.writeInt16BE(dY, offset + 2)
  return buffer.writeInt16BE(dZ, offset + 4)
}

// The step count that selects the layout shares its var-int with onGround, which a protocol
// definition cannot take apart, so the flag is read and written here along with the delta.
function packProperties ({ onGround, steps = [] }) {
  return (onGround ? 1 : 0) | (steps.length << 1)
}

function readVecDelta (buffer, offset) {
  const { value: properties, size } = readVarInt(buffer, offset)
  const onGround = (properties & 1) === 1
  const stepCount = properties >>> 1
  let cursor = offset + size

  if (stepCount === 0) {
    return { value: { onGround, ...readDelta(buffer, cursor) }, size: size + DELTA_SIZE }
  }

  const steps = []
  for (let i = 0; i < stepCount; i++) {
    const { value: ticks, size: ticksSize } = readVarInt(buffer, cursor)
    steps.push({ ticks, ...readDelta(buffer, cursor + ticksSize) })
    cursor += ticksSize + DELTA_SIZE
  }
  return { value: { onGround, steps }, size: cursor - offset }
}

function writeVecDelta (value, buffer, offset) {
  const { steps = [] } = value
  offset = writeVarInt(packProperties(value), buffer, offset)
  if (steps.length === 0) return writeDelta(value, buffer, offset)

  for (const step of steps) {
    offset = writeDelta(step, buffer, writeVarInt(step.ticks, buffer, offset))
  }
  return offset
}

function sizeOfVecDelta (value) {
  const { steps = [] } = value
  const size = sizeOfVarInt(packProperties(value))
  if (steps.length === 0) return size + DELTA_SIZE
  return steps.reduce((total, step) => total + sizeOfVarInt(step.ticks) + DELTA_SIZE, size)
}

module.exports = [readVecDelta, writeVecDelta, sizeOfVecDelta]
