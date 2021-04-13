const { createSerializer, createDeserializer, states } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')

const serializer = createSerializer({ state: states.PLAY, version: '1.16.5', isServer: true })
const deserializer = createDeserializer({ state: states.PLAY, version: '1.16.5' })

function convertBufferToObject (buffer) {
  return deserializer.parsePacketBuffer(buffer)
}

function convertObjectToBuffer (object) {
  return serializer.createPacketBuffer(object)
}

const buffer = mcPackets.pc['1.16.5']['from-server'].abilities[0].raw
const parsed = convertBufferToObject(buffer).data
const parsedBuffer = convertObjectToBuffer(parsed)
console.log(buffer)
console.log(parsedBuffer)
console.log(buffer.equals(parsedBuffer))
