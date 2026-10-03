/* eslint-env mocha */

const EventEmitter = require('events')
const assert = require('power-assert')
const injectChat = require('../src/server/chat')
const mcData = require('minecraft-data')('1.19.2')

const SENDER_A = '11111111-1111-1111-1111-111111111111'
const SENDER_B = '22222222-2222-2222-2222-222222222222'

function makeServer () {
  const client = new EventEmitter()
  client.supportFeature = mcData.supportFeature
  client.settings = {}
  client.socket = { address: () => '127.0.0.1' }
  const ended = []
  const errors = []
  client.end = (reason) => ended.push(reason)
  client.on('error', (err) => errors.push(err))
  injectChat(client, mcData, { enforceSecureProfile: true, hideErrors: true })
  client.verifyMessage = () => true // injectChat installs the real verifier; stub it after injection
  return { client, ended, errors }
}

function chat (previousMessages, lastRejectedMessage) {
  return { timestamp: BigInt(Date.now()), previousMessages, lastRejectedMessage }
}

function seen (sender, signature) {
  return { messageSender: sender, messageSignature: Buffer.from(signature) }
}

describe('1.19.2v server chat Pending lastSeen bookkeeping', () => {
  it('validates a chain of acknowledgements across chat packets', () => {
    const { client, ended, errors } = makeServer()
    client.logSentMessageFromPeer({ senderUuid: SENDER_A, signature: Buffer.from('sig-a1'), timestamp: 1n })
    client.logSentMessageFromPeer({ senderUuid: SENDER_B, signature: Buffer.from('sig-b1'), timestamp: 2n })
    client.logSentMessageFromPeer({ senderUuid: SENDER_A, signature: Buffer.from('sig-a2'), timestamp: 3n })

    client.emit('chat_message', chat([seen(SENDER_A, 'sig-a1'), seen(SENDER_B, 'sig-b1')]))
    // B's entry repeats (re-parsed buffer, same bytes); A's second message is new
    client.emit('chat_message', chat([seen(SENDER_B, 'sig-b1'), seen(SENDER_A, 'sig-a2')]))

    assert.deepStrictEqual(ended, [])
    assert.deepStrictEqual(errors, [])
  })

  it('still rejects a message the server never sent', () => {
    const { client, ended } = makeServer()
    client.logSentMessageFromPeer({ senderUuid: SENDER_A, signature: Buffer.from('sig-a1'), timestamp: 1n })
    client.emit('chat_message', chat([seen(SENDER_A, 'sig-a1')]))
    client.emit('chat_message', chat([seen(SENDER_B, 'sig-unknown')]))
    assert.deepStrictEqual(ended, ['multiplayer.disconnect.chat_validation_failed'])
  })
})
