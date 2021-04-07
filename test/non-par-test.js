/* eslint-env mocha */
// Tests packet serialization/deserialization from with raw binary from minecraft-packets
const testedVersions = ['1.16', '1.16.5']

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
  assert.strictEqual(areEq, true, `Error when testing ${+packetIx + 1} ${packetName} packet`)
}

testedVersions.forEach((ver, i) => {
  describe(`Test version ${ver}`, () => {
    const data = mcPackets.pc[ver]
    serializer = makeClientSerializer(ver)
    deserializer = makeClientDeserializer(ver)
    // server -> client
    let counter = 0
    Object.entries(data['from-server']).forEach(([packetName, packetData]) => {
      it(`${packetName} packet`, () => {
        for (const i in packetData) {
          testBuffer(packetData[i].raw, [packetName, i])
          counter++
        }
      })
    })
    console.log(`Cycled ${counter} packets for ${ver} successfully`)
  })
})
