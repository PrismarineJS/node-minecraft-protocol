/* eslint-env mocha */
// Tests packet serialization/deserialization from with raw binary from minecraft-packets
const { createSerializer, createDeserializer, states } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')
const assert = require('assert')

const makeClientSerializer = version => createSerializer({ state: states.PLAY, version, isServer: true })
const makeClientDeserializer = version => createDeserializer({ state: states.PLAY, version })

Object.entries(mcPackets.pc).forEach(([ver, data]) => {
  let serializer, deserializer

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
  describe(`Test version ${ver}`, () => {
    serializer = makeClientSerializer(ver)
    deserializer = makeClientDeserializer(ver)
    // server -> client
    Object.entries(data['from-server']).forEach(([packetName, packetData]) => {
      it(`${packetName} packet`, () => {
        for (const i in packetData) {
          testBuffer(packetData[i].raw, [packetName, i])
        }
      })
    })
  })
})
