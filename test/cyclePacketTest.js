/* eslint-env mocha */
// Tests packet serialization/deserialization from with raw binary from minecraft-packets
const { createSerializer, createDeserializer, states, supportedVersions } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')
const assert = require('assert')

const makeClientSerializer = version => createSerializer({ state: states.PLAY, version, isServer: true })
const makeClientDeserializer = version => createDeserializer({ state: states.PLAY, version })

for (const supportedVersion of supportedVersions) {
  let serializer, deserializer
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version

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
  describe(`Test cycle packet for version ${version.minecraftVersion}`, () => {
    serializer = makeClientSerializer(version.minecraftVersion)
    deserializer = makeClientDeserializer(version.minecraftVersion)
    if (mcPackets.pc[version.minecraftVersion] === undefined) {
      console.log(`Version ${version.minecraftVersion} has no packet dump.`)
      return
    }
    const data = mcPackets.pc[version.minecraftVersion]
    // server -> client
    Object.entries(data['from-server']).forEach(([packetName, packetData]) => {
      it(`${packetName} packet`, () => {
        for (const i in packetData) {
          testBuffer(packetData[i].raw, [packetName, i])
        }
      })
    })
  })
}
