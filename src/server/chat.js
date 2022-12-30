module.exports = function (client, server, options) {
  class VerificationError extends Error {}
  const raise = (translatableError) => client.end(translatableError, JSON.stringify({ translate: translatableError }))

  const pending = new class extends Array {
    map = {}
    lastSeen = []

    get (sender, signature) {
      return this.map[sender]?.[signature]
    }

    add (sender, signature, ts) {
      this.map[sender] = this.map[sender] || {}
      this.map[sender][signature] = ts
      this.push([sender, signature])
    }

    acknowledge (sender, username) {
      delete this.map[sender][username]
      this.splice(this.findIndex(([a, b]) => a === sender && b === username), 1)
    }

    acknowledgePrior (sender, signature) {
      for (let i = 0; i < this.length; i++) {
        const [a, b] = this[i]
        delete this.map[a]
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

    setPreviouslyAcknowledged (lastSeen, lastRejected) {
      this.lastSeen = lastSeen.map(e => Object.values(e)).push(Object.values(lastRejected))
    }

    previouslyAcknowledged (sender, signature) {
      return this.lastSeen.some(([a, b]) => a === sender && b === signature)
    }
  }()

  function validateLastMessages (lastSeen, lastRejected) {
    if (lastRejected) {
      const rejectedTs = pending.get(lastRejected.sender, lastRejected.signature)
      if (!rejectedTs) {
        throw new VerificationError(`Client rejected a message we never sent from '${lastRejected.sender}'`)
      } else {
        pending.acknowledge(lastRejected.sender, lastRejected.signature)
      }
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

  function validateMessage (packet) {
    try {
      validateLastMessages(packet.previousMessages, packet.lastRejectedMessage)
    } catch (e) {
      if (e instanceof VerificationError) {
        raise('multiplayer.disconnect.chat_validation_failed')
        if (!options.hideErrors) {
          console.error(client.address, 'disconnected because', e)
        }
      } else {
        client.emit('error', e)
      }
    }
  }

  // Listen to chat messages and verify the `lastSeen` and `lastRejected` messages chain
  let lastTimestamp
  client.on('chat_message', (packet) => {
    if (!options.enforceSecureProfile) return // nothing signable

    if (lastTimestamp && packet.timestamp < lastTimestamp) {
      return raise('multiplayer.disconnect.out_of_order_chat')
    }
    lastTimestamp = packet.timestamp

    if (client.settings.disabledChat) {
      return raise('chat.disabled.options')
    }
    validateMessage(packet)
  })

  client.on('message_acknowledgement', (packet) => {
    validateMessage(packet)
  })

  // Send a signed message from one player to another player on the server
  client.logSentMessageFromPeer = (chatPacket) => {
    if (!options.enforceSecureProfile) return // nothing signable

    pending.add(chatPacket.senderUuid, chatPacket.signature, chatPacket.timestamp)
    if (pending.length > 4096) {
      raise('multiplayer.disconnect.too_many_pending_chats')
      return false
    }
    return true
  }
}
