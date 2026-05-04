/* eslint-env mocha */

const assert = require('assert')
const EventEmitter = require('events')
const minecraftDataPath = require.resolve('minecraft-data')
const injectChatPlugin = require('../src/client/chat')

describe('declare_commands handling', () => {
  let originalMinecraftData

  beforeEach(() => {
    originalMinecraftData = require.cache[minecraftDataPath]?.exports
    require.cache[minecraftDataPath] = {
      exports: () => ({
        supportFeature (feature) {
          return feature === 'useChatSessions' || feature === 'seperateSignedChatCommandPacket'
        }
      })
    }
  })

  afterEach(() => {
    if (originalMinecraftData) {
      require.cache[minecraftDataPath] = { exports: originalMinecraftData }
    } else {
      delete require.cache[minecraftDataPath]
    }
  })

  it('tracks message arguments from structured declare_commands nodes', () => {
    const client = new EventEmitter()
    client.version = '26.1'
    client.verifyMessage = () => true
    client.profileKeys = true
    client._session = { uuid: '00000000-0000-0000-0000-000000000000' }

    const writes = []
    client.write = (name, data) => writes.push({ name, data })

    injectChatPlugin(client, {})
    client.signMessage = () => Buffer.from([1])

    client.emit('declare_commands', {
      nodes: [
        { children: [1] },
        { children: [2], extraNodeData: { name: 'msg' } },
        { children: [], extraNodeData: { name: 'message', parser: 'minecraft:message' } }
      ]
    })

    client._signedChat('/msg hello there', { timestamp: 1n, salt: 1n })

    assert.strictEqual(writes.length, 1)
    assert.strictEqual(writes[0].name, 'chat_command_signed')
    assert.deepStrictEqual(writes[0].data.argumentSignatures.map(sig => sig.argumentName), ['message'])
  })

})
