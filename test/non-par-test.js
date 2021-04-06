// Tests packet serialization/deserialization from with raw binary from minecraft-packets

const testedVersions = []

const { createSerializer, createDeserializer, states } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')
const assert = require('assert')

const makeClientSerializer = version => createSerializer({ state: states.PLAY, version, isServer: true })
const makeClientDeserializer = version => createDeserializer({ state: states.PLAY, version })
let serializer = null
let deserializer = null

function convertBufferToObject (buffer) {
  return deserializer.parsePacketBuffer(buffer)
}

function convertObjectToBuffer (object) {
  return serializer.createPacketBuffer(object)
}

function testBuffer (buffer, [packetName, packetIx]) {
  const parsed = convertBufferToObject(buffer).data
  const parsedBuffer = convertObjectToBuffer(parsed)
  const areEq = buffer.equals(parsedBuffer)
  assert(areEq === true, `Error when testing ${+packetIx + 1} ${packetName} packet`)
}

Object.entries(mcPackets.pc).forEach(([ver, data]) => {
  serializer = makeClientSerializer(ver)
  deserializer = makeClientDeserializer(ver)
  // server -> client
  console.log(`${ver} tests starting now!`)
  let counter = 0
  Object.entries(data['from-server']).forEach(([packetName, packetData]) => {
    for (const i in packetData) {
      testBuffer(packetData[i].raw, [packetName, i])
      counter++
    }
  })
  console.log(`Cycled ${counter} packets for ${ver} successfully`)
})
