const states = require('../states')
const crypto = require('crypto')
const concat = require('../transforms/binaryStream').concat

module.exports = function (client, options) {
  client.serverFeatures = {}
  client.on('server_data', (packet) => {
    client.serverFeatures = {
      chatPreview: packet.previewsChat,
      enforcesSecureChat: packet.enforcesSecureChat
    }
  })

  client.once('success', onLogin)

  function onLogin (packet) {
    const mcData = require('minecraft-data')(client.version)
    client.state = states.PLAY
    client.uuid = packet.uuid
    client.username = packet.username

    client._players = {}
    // This stores the last 5 messages that the player has seen, from unique players
    client._lastSeenMessages = new class extends Array {
      capacity = 5
      pending = 0
      push (e) {
        // todo: optimize for one pass
        const ix = this.findIndex((v) => v.sender === e.sender)
        if (ix === -1) {
          this.unshift(e)
        } else {
          this.splice(ix, 1)
          this.unshift(e)
        }
        while (this.length >= this.capacity) this.pop()
      }
    }()
    // This stores last 1024 inbound messages for report lookup
    client._lastChatHistory = new class extends Array {
      capacity = 1024
      push (e) {
        super.push(e)
        if (this.length > this.capacity) {
          this.shift()
        }
      }
    }()
    client._lastChatSignature = null
    client._lastRejectedMessage = null

    if (mcData.supportFeature('chainedChatWithHashing') && !options.disableChatSigning) {
      client.on('player_info', (packet) => {
        if (packet.action === 0) { // add player
          for (const player of packet.data) {
            client._players[player.UUID] = packet.crypto
            client._players[player.UUID].hasChainIntegrity = true
          }
        } else if (packet.action === 4) { // remove player
          for (const player of packet.data) {
            delete client._players[player.UUID]
          }
        }
      })
    }

    function updateAndValidateChat (uuid, previousHeaderSignature, currentHeaderSignature, payload) {
      // Get the player information
      const player = client._players[uuid]
      if (player && player.hasChainIntegrity) {
        if (!player.lastSignature) {
          // First time client is handling a chat message from this player, allow
          player.lastSignature = currentHeaderSignature
        } else if (player.lastSignature.equals(previousHeaderSignature)) {
          player.lastSignature = currentHeaderSignature
        } else {
          // Not valid, client can no longer authenticate messages until player quits and reconnects
          player.hasChainIntegrity = false
        }

        if (player.hasChainIntegrity) {
          const verifier = crypto.createVerify('RSA-SHA256')
          if (previousHeaderSignature) verifier.update(previousHeaderSignature)
          verifier.update(concat('uuid', uuid))
          verifier.update(payload)
          const ok = verifier.verify(player.publicKey, currentHeaderSignature)

          if (!ok) {
            player.hasChainIntegrity = false
          }
        }

        // TODO: Check if expired among other things
        return player.hasChainIntegrity
      }

      return false
    }

    client.on('message_header', (packet) => {
      if (options.disableChatSigning) return

      // Confusingly, "messageSignature" is the previous header signature, and headerSignature is current one
      // and the "bodyDigest" is the current message hash
      updateAndValidateChat(packet.senderUuid, packet.messageSignature, packet.headerSignature, packet.bodyDigest)

      client._lastChatHistory.push({
        previousSignature: packet.messageSignature,
        signature: packet.headerSignature,
        messageHash: packet.bodyDigest
      })
    })

    client.on('player_chat', (packet) => {
      if (options.disableChatSigning || !mcData.supportFeature('signedChat')) {
        client.emit('playerChat', { ...packet, verified: false })
        return
      } else if (!mcData.supportFeature('chainedChatWithHashing')) {
        const pubKey = client._players[packet.senderUuid]?.publicKey
        client.emit('playerChat', { ...packet, verified: pubKey ? client.verifyMessage(pubKey, packet) : false })
        return
      }

      const hash = crypto.createHash('sha256')
      hash.update(concat('i64', packet.salt, 'i64', packet.timestamp / 1000n, 'pstring', packet.plainMessage, 'i8', 70))
      if (packet.formattedMessage) hash.update(packet.formattedMessage)

      const verified = updateAndValidateChat(packet.senderUuid, packet.messageSignature, packet.headerSignature, hash.digest())
      client.emit('playerChat', { ...packet, verified })
      // We still accept a message even if the chain is broken. A vanilla client will reject a message
      // if the client sets secure chat to be required and the message from the server isn't signed,
      // or the client has blocked the sender.
      // client1.19.1/client/net/minecraft/client/multiplayer/ClientPacketListener.java#L768
      client._lastSeenMessagesTracker.push({ sender: packet.senderUuid, signature: packet.headerSignature })
      client._lastChatHistory.push({
        previousSignature: packet.messageSignature,
        signature: packet.headerSignature,
        message: {
          plain: packet.plainMessage,
          decorated: packet.formattedMessage
        },
        messageHash: packet.bodyDigest,
        timestamp: packet.timestamp,
        salt: packet.salt,
        lastSeen: packet.previousMessages
      })

      if (client._lastSeenMessagesTracker.pending++ > 64) {
        client.write('message_acknowledgement', {
          previousMessages: client._lastSeenMessages.map((e) => ({
            messageSender: e.sender,
            messageSignature: e.signature
          })),
          lastRejectedMessage: client._lastRejectedMessage
        })
        client._lastSeenMessagesTracker.pending = 0
      }
    })

    let lastPreviewRequestId = 0
    const pendingChatRequests = {}
    client.chat = async (message, options) => {
      options.timestamp = options.timestamp || Date.now()
      options.salt = options.salt || 0

      if (options.skipPreview || !client.serverFeatures.chatPreview) {
        client.write('chat_message', {
          message,
          timestamp: options.timestamp,
          salt: options.salt,
          signature: client.profileKeys ? client.signMessage(message, options.timestamp, options.salt) : [],
          signedPreview: options.didPreview,
          lastAcceptedMessages: client._lastSeenMessages.map((e) => ({
            messageSender: e.sender,
            messageSignature: e.signature
          })),
          lastRejectedMessage: client._lastRejectedMessage
        })
        client._lastSeenMessagesTracker.pending = 0
      } else {
        client.write('chat_preview', {
          query: lastPreviewRequestId,
          message
        })
        pendingChatRequests[lastPreviewRequestId] = { message, options }
        lastPreviewRequestId++
      }
    }

    function onPreviewResponse (packet) {
      const pending = pendingChatRequests[packet.query]
      if (pending) {
        client.chat(packet.message, { ...packet.options, skipPreview: true, didPreview: true })
        delete pendingChatRequests[packet.query]
      }
    }
    client.on('chat_preview', onPreviewResponse)

    client.signMessage = (message, timestamp, salt = 0) => {
      if (!client.profileKeys) throw Error("Can't sign message without profile keys, please set valid auth mode")
      let signable
      if (mcData.supportFeature('chainedChatWithHashing')) { // 1.19.2
        const hash = crypto.createHash('sha256')
        if (client._lastChatSignature) hash.update(client._lastChatSignature)
        hash.update(concat('i64', salt, 'i64', timestamp / 1000n, 'pstring', JSON.stringify({ text: message }), 'i8', 70))
        signable = hash.digest()
      } else {
        signable = concat('i64', salt, 'UUID', client.uuid, 'i64', timestamp / 1000n, 'pstring', JSON.stringify({ text: message }))
      }
      return (client._lastChatSignature = crypto.sign('RSA-SHA256', signable, client.profileKeys.private))
    }

    // Verification handled internally in 1.19.1+ as previous messages must be stored to verify messages from future players
    if (!mcData.supportFeature('chainedChatWithHashing')) {
      client.verifyMessage = (pubKey, packet) => {
        if (pubKey instanceof Buffer) pubKey = crypto.createPublicKey({ key: pubKey, format: 'der', type: 'spki' })
        const signable = concat('i64', packet.salt, 'UUID', packet.senderUuid,
          'i64', packet.timestamp / 1000n, 'pstring', packet.signedChatContent)
        return crypto.verify('RSA-SHA256', signable, pubKey, packet.signature)
      }
    }

    // Report a chat message.
    client.reportPlayer = (uuid, reason, reportedSignatures, comments) => {
      const evidence = []

      function addEvidence (entry) {
        evidence.push({
          previousHeaderSignature: entry.previousSignature,
          uuid: entry.senderUuid,
          message: entry.message,
          messageHash: entry.messageHash,
          signature: entry.signature,
          timestamp: entry.timestamp,
          salt: entry.salt,
          lastSeen: entry.lastSeen
        })
      }

      for (let i = 0; i < client._lastChatHistory.capacity; i++) {
        const entry = client._lastChatHistory[i]
        for (const reportSig of reportedSignatures) {
          if (reportSig.equals(entry.signature)) addEvidence(entry)
        }
      }

      return client.authflow.mca.reportPlayerChat({
        reason,
        comments,
        messages: evidence,
        reportedPlayer: uuid,
        createdTime: Date.now(),
        clientVersion: client.version,
        serverAddress: options.host + ':' + options.port,
        realmInfo: undefined // { realmId, slotId }
      })
    }
  }
}
