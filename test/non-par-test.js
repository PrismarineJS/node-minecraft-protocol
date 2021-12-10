/* eslint-env mocha */
// Tests packet serialization/deserialization from with raw binary from minecraft-packets
const { createSerializer, createDeserializer, states } = require('minecraft-protocol')
const mcPackets = require('minecraft-packets')
const assert = require('assert')

const makeClientSerializer = version => createSerializer({ state: states.PLAY, version, isServer: true })
const makeClientDeserializer = version => createDeserializer({ state: states.PLAY, version })

const { MC_VERSION } = process.env
if (MC_VERSION !== undefined) {
  if (!(MC_VERSION in mcPackets.pc)) {
    throw new Error(`${String(MC_VERSION)} Version not in minecraft-packets`)
  }
  runTestForVersion(MC_VERSION)
} else {
  for (const mcVersion of Object.keys(mcPackets.pc)) {
    runTestForVersion(mcVersion)
  }
}

const serializers = {}
const deserializers = {}
function cycleBufferFactory (mcVersion) {
  serializers[mcVersion] ??= makeClientSerializer(mcVersion)
  deserializers[mcVersion] ??= makeClientDeserializer(mcVersion)
  const Buffer2Parsed = b => deserializers[mcVersion].parsePacketBuffer(b).data
  const Parsed2Buffer = obj => serializers[mcVersion].createPacketBuffer(obj)
  return buffer => Parsed2Buffer(Buffer2Parsed(buffer))
}

function runTestForVersion (mcVersion) {
  describe(`Test version ${mcVersion}`, () => {
    const cycleBuffer = cycleBufferFactory(mcVersion)
    function testBuffer (buffer, [packetName, packetIx]) {
      const cycled = cycleBuffer(buffer)
      assert.strictEqual(buffer.equals(cycled), true, `Error when testing ${+packetIx + 1} ${packetName} packet`)
    }
    // server -> client
    const data = mcPackets.pc[mcVersion].data['from-server']
    for (const [packetName, packetData] of data) {
      it(`${packetName} packet`, () => {
        for (const i in packetData) {
          testBuffer(packetData[i].raw, [packetName, i])
        }
      })
    }
  })
}
