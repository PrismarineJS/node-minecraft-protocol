/* eslint-env mocha */

const mc = require('../')
const assert = require('power-assert')
const { once } = require('events')
const { getPort } = require('./common/util')

// FullPacketParser only emits 'partialReadError' since protodef 1.20.0 ; before that, partial reads are swallowed
const protodefVersion = require('protodef/package.json').version.split('.').map(Number)
const protodefEmitsPartialReadError = protodefVersion[0] > 1 || (protodefVersion[0] === 1 && protodefVersion[1] >= 20)

function writeVarint (value) {
  const bytes = []
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80)
    value >>>= 7
  }
  bytes.push(value)
  return Buffer.from(bytes)
}

for (const supportedVersion of mc.supportedVersions) {
  const mcData = require('minecraft-data')(supportedVersion)
  const version = mcData.version

  const packetMappings = mcData.protocol.play.toClient.types.packet[1][0].type[1].mappings
  const keepAliveId = parseInt(Object.keys(packetMappings).find(id => packetMappings[id] === 'keep_alive'))
  const keepAliveIdType = mcData.protocol.play.toClient.types.packet_keep_alive[1][0].type
  const validKeepAlive = mc.createSerializer({ state: mc.states.PLAY, isServer: true, version: version.minecraftVersion })
    .createPacketBuffer({ name: 'keep_alive', params: { keepAliveId: keepAliveIdType === 'i64' ? 42n : 42 } })

  describe('packetParseFailure ' + supportedVersion + 'v', function () {
    this.timeout(10000)

    // Starts a server and connects a client to it ; resolves once the server-side client is in play state
    async function connect () {
      const port = await getPort()
      const server = mc.createServer({
        'online-mode': false,
        version: version.minecraftVersion,
        port
      })
      const serverErrors = []
      server.on('error', err => serverErrors.push(err))
      await once(server, 'listening')
      const client = mc.createClient({
        username: 'parseFailure',
        host: '127.0.0.1',
        version: version.minecraftVersion,
        port
      })
      const [serverClient] = await once(server, 'playerJoin')
      // The client only enters play after the server does on older versions
      if (client.state !== mc.states.PLAY) await once(client, 'state')
      assert.strictEqual(client.state, mc.states.PLAY)
      const close = async () => {
        client.end()
        server.close()
        await once(server, 'close')
        assert.deepStrictEqual(serverErrors, [])
      }
      return { client, serverClient, close }
    }

    it('emits PartialReadError for a packet whose body is missing', async function () {
      if (!protodefEmitsPartialReadError) return this.skip()
      const sent = writeVarint(keepAliveId)
      const { client, serverClient, close } = await connect()
      const failurePromise = once(client, 'packetParseFailure')
      serverClient.writeRaw(sent)
      const [failure] = await failurePromise
      assert.strictEqual(failure.type, 'PartialReadError')
      assert.strictEqual(failure.state, 'play')
      assert.strictEqual(failure.direction, 'toClient')
      assert.strictEqual(failure.packetId, keepAliveId)
      assert.strictEqual(failure.packetName, 'keep_alive')
      assert.ok(failure.buffer.equals(sent), `buffer ${failure.buffer.toString('hex')} !== ${sent.toString('hex')}`)
      assert.ok(failure.error instanceof Error)
      assert.ok(failure.error.partialReadError)
      assert.strictEqual(failure.bytesRead, null)
      assert.strictEqual(failure.partialData, null)
      await close()
    })

    it('emits SizeMismatch for a packet with trailing bytes, and still emits the packet', async function () {
      const sent = Buffer.concat([validKeepAlive, Buffer.from([0xde, 0xad, 0xbe, 0xef])])
      const { client, serverClient, close } = await connect()
      const failurePromise = once(client, 'packetParseFailure')
      const packetPromise = once(client, 'keep_alive')
      serverClient.writeRaw(sent)
      const [failure] = await failurePromise
      assert.strictEqual(failure.type, 'SizeMismatch')
      assert.strictEqual(failure.state, 'play')
      assert.strictEqual(failure.direction, 'toClient')
      assert.strictEqual(failure.packetId, keepAliveId)
      assert.strictEqual(failure.packetName, 'keep_alive')
      assert.ok(failure.buffer.equals(sent), `buffer ${failure.buffer.toString('hex')} !== ${sent.toString('hex')}`)
      assert.strictEqual(failure.bytesRead, validKeepAlive.length)
      assert.ok(failure.bytesRead < failure.buffer.length)
      assert.strictEqual(failure.error, null)
      assert.strictEqual(failure.partialData.name, 'keep_alive')
      assert.strictEqual(Number(failure.partialData.params.keepAliveId), 42)
      const [keepAlive] = await packetPromise
      assert.strictEqual(Number(keepAlive.keepAliveId), 42)
      await close()
    })

    it('does not emit anything for a well-formed packet', async function () {
      const { client, serverClient, close } = await connect()
      let failures = 0
      client.on('packetParseFailure', () => failures++)
      const packetPromise = once(client, 'keep_alive')
      serverClient.writeRaw(validKeepAlive)
      await packetPromise
      assert.strictEqual(failures, 0)
      await close()
    })
  })
}
