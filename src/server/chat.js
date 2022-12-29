module.exports = function (client, server, options) {
  class VerificationError extends Error {}
  const raise = (translatableError) => client.end(translatableError, JSON.stringify({ translate: translatableError }))

  const pendingACK = {} // userUUID => { signature, ts }
  let pendingACKCount = 0

  let lastTimestamp
  function validateLastMessages (lastSeen, lastRejected) {
    if (lastRejected) {
      const rejectedTs = pendingACK[lastRejected.sender][lastRejected.signature]
      if (!rejectedTs) {
        throw new VerificationError(`Client rejected a message we never sent from '${lastRejected.sender}'`)
      } else {
        delete pendingACK[lastRejected.sender][lastRejected.signature]
        pendingACKCount--
      }
    }

    const seenSenders = new Set()
    for (const { messageSender, messageSignature } of lastSeen) {
      const ts = pendingACK[messageSender][messageSignature]
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
        for (const signature in pendingACK[messageSender]) {
          if (signature !== messageSender) {
            delete pendingACK[messageSender][messageSignature]
            pendingACKCount--
          } else {
            break
          }
        }
      }
    }
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
  client.on('chat_message', (packet) => {
    if (!options.enforceSecureProfile) {
      return // nothing signable
    }

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
    if (!options.enforceSecureProfile) {
      return // nothing signable
    }
    const sender = chatPacket.senderUuid
    const pendingUsers = Object.keys(pendingACK)
    for (let i = 0; i < (pendingUsers.length - 10); i++) {
      for (const signature in pendingACK[pendingUsers[i]]) { // eslint-disable-line
        pendingACKCount--
      }
      delete pendingACK[pendingUsers[i]]
    }
    ;(pendingACK[sender] ??= {})[chatPacket.signature] = chatPacket.timestamp
    pendingACKCount++
    if (pendingACKCount > 4096) {
      raise('multiplayer.disconnect.too_many_pending_chats')
      return false
    }
    return true
  }
}
