const crypto = require('crypto')
const concat = require('../transforms/binaryStream').concat
const debug = require('debug')('minecraft-protocol')
const messageExpireTime = 300000 // 5 min (ms)
const { mojangPublicKeyPem } = require('./constants')

class VerificationError extends Error {}
function validateLastMessages (pending, lastSeen, lastRejected) {
  if (lastRejected) {
    const rejectedTime = pending.get(lastRejected.sender, lastRejected.signature)
    if (rejectedTime) pending.acknowledge(lastRejected.sender, lastRejected.signature)
    else throw new VerificationError(`Client rejected a message we never sent from '${lastRejected.sender}'`)
  }

  let lastTimestamp
  const seenSenders = new Set()

  for (const { messageSender, messageSignature } of lastSeen) {
    if (pending.previouslyAcknowledged(messageSender, messageSignature)) continue

    const ts = pending.get(messageSender)(messageSignature)
    if (!ts) {
      throw new VerificationError(`Client saw a message that we never sent from '${messageSender}'`)
    } else if (lastTimestamp && (ts < lastTimestamp)) {
      throw new VerificationError(`Received messages out of order: Last acknowledged timestamp was at ${lastTimestamp}, now reading older message at ${ts}`)
    } else if (seenSenders.has(messageSender)) {
      // in the lastSeen array, last 5 messages from different players are stored, not just last 5 messages
      throw new VerificationError(`Two last seen entries from same player not allowed: ${messageSender}`)
    } else {
      lastTimestamp = ts
      seenSenders.add(messageSender)
      pending.acknowledgePrior(messageSender, messageSignature)
    }
  }

  pending.setPreviouslyAcknowledged(lastSeen, lastRejected)
}

module.exports = function (client, server, options) {
  const mojangPubKey = crypto.createPublicKey(mojangPublicKeyPem)
  const raise = (translatableError) => client.end(translatableError, JSON.stringify({ translate: translatableError }))
  const pending = client.supportFeature('useChatSessions') ? new LastSeenMessages() : new Pending()

  if (!options.generatePreview) options.generatePreview = message => message

  function validateMessageChain (packet) {
    try {
      validateLastMessages(pending, packet.previousMessages, packet.lastRejectedMessage)
    } catch (e) {
      if (e instanceof VerificationError) {
        raise('multiplayer.disconnect.chat_validation_failed')
        if (!options.hideErrors) console.error(client.address, 'disconnected because', e)
      } else {
        client.emit('error', e)
      }
    }
  }

  function validateSession (packet) {
    try {
      const unwrapped = pending.unwrap(packet.offset, packet.acknowledged)

      const length = Buffer.byteLength(packet.message, 'utf8')
      const acknowledgements = unwrapped.length > 0 ? ['i32', unwrapped.length, 'buffer', Buffer.concat(...unwrapped)] : ['i32', 0]

      const signable = concat('i32', 1, 'UUID', client.uuid, 'UUID', client._session.uuid, 'i32', client._session.index++, 'i64', packet.salt, 'i64', packet.timestamp / 1000n, 'i32', length, 'pstring', packet.message, ...acknowledgements)
      const valid = crypto.verify('RSA-SHA256', signable, client.profileKeys.public, packet.signature)
      if (!valid) throw VerificationError('Invalid or missing message signature')
    } catch (e) {
      if (e instanceof VerificationError) {
        raise('multiplayer.disconnect.chat_validation_failed')
        if (!options.hideErrors) console.error(client.address, 'disconnected because', e)
      } else {
        client.emit('error', e)
      }
    }
  }

  client.on('chat_session_update', (packet) => {
    client._session = {
      index: 0,
      uuid: packet.sessionUuid
    }

    const publicKey = crypto.createPublicKey({ key: packet.publicKey, format: 'der', type: 'spki' })
    const signable = concat('UUID', client.uuid, 'i64', packet.expireTime, 'buffer', publicKey.export({ type: 'spki', format: 'der' }))

    // This makes sure 'signable' when signed with the mojang private key equals signature in this packet
    if (!crypto.verify('RSA-SHA1', signable, mojangPubKey, packet.signature)) {
      debug('Signature mismatch')
      raise('multiplayer.disconnect.invalid_public_key_signature')
      return
    }
    client.profileKeys = { public: publicKey }
  })

  // Listen to chat messages and verify the `lastSeen` and `lastRejected` messages chain
  let lastTimestamp
  client.on('chat_message', (packet) => {
    if (!options.enforceSecureProfile) return // nothing signable

    if ((lastTimestamp && packet.timestamp < lastTimestamp) || (packet.timestamp > Date.now())) {
      return raise('multiplayer.disconnect.out_of_order_chat')
    }
    lastTimestamp = packet.timestamp

    // Checks here: 1) make sure client can chat, 2) chain/session is OK, 3) signature is OK, 4) log if expired
    if (client.settings.disabledChat) return raise('chat.disabled.options')
    if (client.supportFeature('chainedChatWithHashing')) validateMessageChain(packet) // 1.19.1
    if (client.supportFeature('useChatSessions')) validateSession(packet) // 1.19.3
    else if (!client.verifyMessage(packet)) raise('multiplayer.disconnect.unsigned_chat')
    if ((BigInt(Date.now()) - packet.timestamp) > messageExpireTime) debug(client.socket.address(), 'sent expired message TS', packet.timestamp)
  })

  // Client will occasionally send a list of seen messages to the server, here we listen & check chain validity
  client.on('message_acknowledgement', (packet) => {
    if (client.supportFeature('useChatSessions')) {
      const valid = client._lastSeenMessages.applyOffset(packet.count)
      if (!valid) {
        raise('multiplayer.disconnect.chat_validation_failed')
        if (!options.hideErrors) console.error(client.address, 'disconnected because', VerificationError('Failed to validate message acknowledgements'))
      }
    } else validateMessageChain(packet)
  })

  client.verifyMessage = (packet) => {
    if (!client.profileKeys) return null
    if (client.supportFeature('useChatSessions')) throw Error('client.verifyMessage is deprecated. Does not work for 1.19.3 and above')

    if (client.supportFeature('chainedChatWithHashing')) { // 1.19.1
      if (client._lastChatSignature === packet.signature) return true // Called twice
      const verifier = crypto.createVerify('RSA-SHA256')
      if (client._lastChatSignature) verifier.update(client._lastChatSignature)
      verifier.update(concat('UUID', client.uuid))

      // Hash of chat body now opposed to signing plaintext. This lets server give us hashes for chat
      // chain without needing to reveal message contents
      if (packet.bodyDigest) {
        // Header
        verifier.update(packet.bodyDigest)
      } else {
        // Player Chat
        const hash = crypto.createHash('sha256')
        hash.update(concat('i64', packet.salt, 'i64', packet.timestamp / 1000n, 'pstring', packet.message, 'i8', 70))
        if (packet.signedPreview) hash.update(options.generatePreview(packet.message))
        for (const { messageSender, messageSignature } of packet.previousMessages) {
          hash.update(concat('i8', 70, 'UUID', messageSender))
          hash.update(messageSignature)
        }
        // Feed hash back into signing payload
        verifier.update(hash.digest())
      }
      client._lastChatSignature = packet.signature
      return verifier.verify(client.profileKeys.public, packet.signature)
    } else { // 1.19
      const signable = concat('i64', packet.salt, 'UUID', client.uuid, 'i64', packet.timestamp, 'pstring', packet.message)
      return crypto.verify('sha256WithRSAEncryption', signable, client.profileKeys.public, packet.signature)
    }
  }

  // On 1.19.1+, outbound messages from server (client->SERVER->players) are logged so we can verify
  // the last seen message field in inbound chat packets
  client.logSentMessageFromPeer = (chatPacket) => {
    if (!options.enforceSecureProfile || !server.features.signedChat) return // nothing signable

    pending.add(chatPacket.senderUuid, chatPacket.signature, chatPacket.timestamp)
    if (pending.length > 4096) {
      raise('multiplayer.disconnect.too_many_pending_chats')
      return false
    }
    return true
  }
}

class LastSeenMessages extends Array {
  tracking = 20

  constructor () {
    super()
    for (let i = 0; i < this.tracking; i++) this.push(null)
  }

  add (sender, signature) {
    this.push({ signature, pending: true })
  }

  applyOffset (offset) {
    const diff = this.length - this.tracking
    if (offset >= 0 && offset <= diff) {
      this.splice(0, offset)
      return true
    }

    return false
  }

  unwrap (offset, acknowledged) {
    if (!this.applyOffset(offset)) throw VerificationError('Failed to validate message acknowledgements')

    const n = (acknowledged[2] << 16) | (acknowledged[1] << 8) | acknowledged[0]

    const unwrapped = []
    for (let i = 0; i < this.tracking; i++) {
      const ack = n & (1 << i)
      const tracked = this[i]
      if (ack) {
        if (tracked === null) throw VerificationError('Failed to validate message acknowledgements')

        tracked.pending = false
        unwrapped.push(tracked.signature)
      } else {
        if (tracked !== null && !tracked.pending) throw VerificationError('Failed to validate message acknowledgements')

        this[i] = null
      }
    }

    return unwrapped
  }
}

class Pending extends Array {
  m = {}
  lastSeen = []

  get (sender, signature) {
    return this.m[sender]?.[signature]
  }

  add (sender, signature, ts) {
    this.m[sender] = this.m[sender] || {}
    this.m[sender][signature] = ts
    this.push([sender, signature])
  }

  acknowledge (sender, username) {
    delete this.m[sender][username]
    this.splice(this.findIndex(([a, b]) => a === sender && b === username), 1)
  }

  acknowledgePrior (sender, signature) {
    for (let i = 0; i < this.length; i++) {
      const [a, b] = this[i]
      delete this.m[a]
      if (a === sender && b === signature) {
        this.splice(0, i)
        break
      }
    }
  }

  // Once we've acknowledged that the client has saw the messages we sent,
  // we delete it from our map & pending list. However, the client may keep it in
  // their 5-length lastSeen list anyway. Once we verify/ack the client's lastSeen array,
  // we need to store it in memory to allow those entries to be approved again without
  // erroring about a message we never sent in the next serverbound message packet we get.
  setPreviouslyAcknowledged (lastSeen, lastRejected = {}) {
    this.lastSeen = lastSeen.map(e => Object.values(e)).push(Object.values(lastRejected))
  }

  previouslyAcknowledged (sender, signature) {
    return this.lastSeen.some(([a, b]) => a === sender && b === signature)
  }
}
