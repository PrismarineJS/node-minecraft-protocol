/* eslint-env mocha */

const assert = require('assert')
const Client = require('../src/client')
const play = require('../src/client/play')
const states = require('../src/states')
const { supportedVersions } = require('../src/version')

for (const supportedVersion of supportedVersions) {
  const mcData = require('minecraft-data')(supportedVersion)
  if (!mcData.supportFeature('hasConfigurationState')) continue

  describe('configuration state ' + supportedVersion + 'v', () => {
    it('precompiles the play protocol before acknowledging finish_configuration', async () => {
      const client = new Client(false, supportedVersion)
      const events = []
      const setSerializer = client.setSerializer
      client.setSerializer = function (state) {
        events.push('serializer:' + state)
        return setSerializer.call(this, state)
      }
      if (client.precompileState) {
        const precompileState = client.precompileState
        client.precompileState = function (state) {
          events.push('precompile:' + state)
          return precompileState.call(this, state)
        }
      }
      const write = client.write
      client.write = function (name, params) {
        events.push('write:' + name + ':' + this.state)
        return write.call(this, name, params)
      }

      try {
        play(client, {})
        client.emit('success', { uuid: '00000000-0000-0000-0000-000000000000', username: 'player' })
        events.length = 0

        const configurationSerializer = client.serializer
        const createPacketBuffer = configurationSerializer.createPacketBuffer
        configurationSerializer.createPacketBuffer = function (packet) {
          if (packet.name === 'finish_configuration') events.push('serialize:finish_configuration:' + client.state)
          return createPacketBuffer.call(this, packet)
        }

        client.emit('finish_configuration')
        await new Promise(resolve => setImmediate(resolve))

        const precompileIndex = events.indexOf('precompile:' + states.PLAY)
        const ackIndex = events.indexOf('write:finish_configuration:' + states.CONFIGURATION)
        const serializeIndex = events.indexOf('serialize:finish_configuration:' + states.CONFIGURATION)
        const playIndex = events.indexOf('serializer:' + states.PLAY)
        assert.notStrictEqual(precompileIndex, -1, 'play protocol should be precompiled before the acknowledgement: ' + events.join(', '))
        assert.notStrictEqual(ackIndex, -1, 'finish_configuration should be written in the configuration state: ' + events.join(', '))
        assert.notStrictEqual(serializeIndex, -1, 'finish_configuration should use the configuration serializer: ' + events.join(', '))
        assert.ok(precompileIndex < ackIndex, 'play protocol must be precompiled before the acknowledgement: ' + events.join(', '))
        assert.ok(ackIndex < playIndex, 'the client should enter play after acknowledging finish_configuration: ' + events.join(', '))
      } finally {
        client.serializer.destroy()
        client.deserializer.destroy()
        client.removeAllListeners()
      }
    })
  })
}
