/* eslint-env mocha */
// Tests packet serialization/deserialization from with raw binary from minecraft-packets
const { createSerializer, createDeserializer, states, supportedVersions } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')
const assert = require('assert')

const makeClientSerializer = version => createSerializer({ state: states.PLAY, version, isServer: true })
const makeClientDeserializer = version => createDeserializer({ state: states.PLAY, version })

for (const supportedVersion of supportedVersions) {
  let serializer, deserializer, data
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
    if (!areEq) {
      console.log('original buffer', buffer.toString('hex'))
      console.log('cycled buffer', parsedBuffer.toString('hex'))
    }
    assert.strictEqual(areEq, true, `Error when testing ${+packetIx + 1} ${packetName} packet`)
  }
  describe(`Test cycle packet for version ${supportedVersion}v`, () => {
    before(() => {
      serializer = makeClientSerializer(version.minecraftVersion)
      deserializer = makeClientDeserializer(version.minecraftVersion)
    })
    data = mcPackets.pc[version.minecraftVersion]
    it('Has packet data', () => {
      if (data === undefined) {
        // many version do not have data, so print a log for now
        // assert when most versions have packet data
        console.log(`Version ${version.minecraftVersion} has no packet dump.`)
      }
    })
    // server -> client
    if (data !== undefined) {
      Object.entries(data['from-server']).forEach(([packetName, packetData]) => {
        it(`${packetName} packet`, () => {
          for (const i in packetData) {
            testBuffer(packetData[i].raw, [packetName, i])
          }
        })
      })
    }
  })
}
