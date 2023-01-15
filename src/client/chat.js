const crypto = require('crypto')
const concat = require('../transforms/binaryStream').concat
const messageExpireTime = 420000 // 7 minutes (ms)

function isFormatted (message) {
  // This should match the ChatComponent.isDecorated function from Vanilla
  try {
    const comp = JSON.parse(message)
    for (const key in comp) {
      if (key !== 'text') return true
    }
    if (comp.text && comp.text !== message) return true
    return false
  } catch {
    return false
  }
}

module.exports = function (client, options) {
  const mcData = require('minecraft-data')(client.version)
  client._players = {}
  client._lastChatSignature = null
  client._lastRejectedMessage = null

  // This stores the last 5 messages that the player has seen, from unique players
  client._lastSeenMessages = new LastSeenMessages()
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

  function updateAndValidateChat (uuid, previousSignature, currentSignature, payload) {
    // Get the player information
    const player = client._players[uuid]
    if (player && player.hasChainIntegrity) {
      if (!player.lastSignature) {
        // First time client is handling a chat message from this player, allow
        player.lastSignature = currentSignature
      } else if (player.lastSignature.equals(previousSignature)) {
        player.lastSignature = currentSignature
      } else {
        // Not valid, client can no longer authenticate messages until player quits and reconnects
        player.hasChainIntegrity = false
      }

      if (player.hasChainIntegrity) {
        const verifier = crypto.createVerify('RSA-SHA256')
        if (previousSignature) verifier.update(previousSignature)
        verifier.update(concat('UUID', uuid))
        verifier.update(payload)
        player.hasChainIntegrity = verifier.verify(player.publicKey, currentSignature)
      }

      return player.hasChainIntegrity
    }

    return false
  }

  client.on('player_info', (packet) => {
    if (packet.action === 0) { // add player
      for (const player of packet.data) {
        if (player.crypto) {
          client._players[player.UUID] = {
            publicKey: crypto.createPublicKey({ key: player.crypto.publicKey, format: 'der', type: 'spki' }),
            publicKeyDER: player.crypto.publicKey,
            signature: player.crypto.signature,
            displayName: player.displayName || player.name
          }
          client._players[player.UUID].hasChainIntegrity = true
        }
      }
    } else if (packet.action === 4) { // remove player
      for (const player of packet.data) {
        delete client._players[player.UUID]
      }
    }
  })

  client.on('system_chat', (packet) => {
    client.emit('systemChat', {
      positionid: packet.isActionBar ? 2 : 1,
      formattedMessage: packet.content
    })
  })

  client.on('message_header', (packet) => {
    updateAndValidateChat(packet.senderUuid, packet.previousSignature, packet.signature, packet.messageHash)

    client._lastChatHistory.push({
      previousSignature: packet.previousSignature,
      signature: packet.signature,
      messageHash: packet.messageHash
    })
  })

  client.on('player_chat', (packet) => {
    if (!mcData.supportFeature('chainedChatWithHashing')) { // 1.19.0
      const pubKey = client._players[packet.senderUuid]?.publicKey
      client.emit('playerChat', {
        formattedMessage: packet.signedChatContent || packet.unsignedChatContent,
        type: packet.type,
        sender: packet.senderUuid,
        senderName: packet.senderName,
        senderTeam: packet.senderTeam,
        verified: pubKey ? client.verifyMessage(pubKey, packet) : false
      })
      return
    }

    const hash = crypto.createHash('sha256')
    hash.update(concat('i64', packet.salt, 'i64', packet.timestamp / 1000n, 'pstring', packet.plainMessage, 'i8', 70))
    if (packet.formattedMessage) hash.update(packet.formattedMessage)
    for (const previousMessage of packet.previousMessages) {
      hash.update(concat('i8', 70, 'UUID', previousMessage.messageSender))
      hash.update(previousMessage.messageSignature)
    }

    // Chain integrity remains even if message is considered unverified due to expiry
    const tsDelta = BigInt(Date.now()) - packet.timestamp
    const expired = !packet.timestamp || tsDelta > messageExpireTime || tsDelta < 0
    const verified = updateAndValidateChat(packet.senderUuid, packet.previousSignature, packet.signature, hash.digest()) && !expired
    client.emit('playerChat', {
      plainMessage: packet.plainMessage,
      unsignedContent: packet.unsignedChatContent,
      formattedMessage: packet.formattedMessage,
      type: packet.type,
      sender: packet.senderUuid,
      senderName: client._players[packet.senderUuid]?.displayName,
      senderTeam: packet.senderTeam,
      verified
    })

    // We still accept a message (by pushing to seenMessages) even if the chain is broken. A vanilla client
    // will reject a message if the client sets secure chat to be required and the message from the server
    // isn't signed, or the client has blocked the sender.
    // client1.19.1/client/net/minecraft/client/multiplayer/ClientPacketListener.java#L768
    client._lastSeenMessages.push({ sender: packet.senderUuid, signature: packet.signature })
    client._lastChatHistory.push({
      previousSignature: packet.previousSignature,
      signature: packet.signature,
      message: {
        plain: packet.plainMessage,
        decorated: packet.formattedMessage
      },
      messageHash: packet.bodyDigest,
      timestamp: packet.timestamp,
      salt: packet.salt,
      lastSeen: packet.previousMessages
    })

    if (client._lastSeenMessages.pending++ > 64) {
      client.write('message_acknowledgement', {
        previousMessages: client._lastSeenMessages.map((e) => ({
          messageSender: e.sender,
          messageSignature: e.signature
        })),
        lastRejectedMessage: client._lastRejectedMessage
      })
      client._lastSeenMessages.pending = 0
    }
  })

  // Chat Sending
  let pendingChatRequest
  let lastPreviewRequestId = 0

  client._signedChat = (message, options = {}) => {
    options.timestamp = options.timestamp || BigInt(Date.now())
    options.salt = options.salt || 0

    if (options.skipPreview || !client.serverFeatures.chatPreview) {
      client.write('chat_message', {
        message,
        timestamp: options.timestamp,
        salt: options.salt,
        signature: client.profileKeys ? client.signMessage(message, options.timestamp, options.salt, options.preview) : Buffer.alloc(0),
        signedPreview: options.didPreview,
        previousMessages: client._lastSeenMessages.map((e) => ({
          messageSender: e.sender,
          messageSignature: e.signature
        })),
        lastRejectedMessage: client._lastRejectedMessage
      })
      client._lastSeenMessages.pending = 0
    } else {
      client.write('chat_preview', {
        query: lastPreviewRequestId,
        message
      })
      pendingChatRequest = { id: lastPreviewRequestId, message, options }
      lastPreviewRequestId++
    }
  }

  client.on('chat_preview', (packet) => {
    if (pendingChatRequest && pendingChatRequest.id === packet.queryId) {
      client._signedChat(pendingChatRequest.message, { ...pendingChatRequest.options, skipPreview: true, didPreview: true, preview: isFormatted(packet.message) ? packet.message : undefined })
      pendingChatRequest = null
    }
  })

  // Signing methods
  client.signMessage = (message, timestamp, salt = 0, preview) => {
    if (!client.profileKeys) throw Error("Can't sign message without profile keys, please set valid auth mode")

    if (mcData.supportFeature('chainedChatWithHashing')) {
      // 1.19.2
      const signer = crypto.createSign('RSA-SHA256')
      if (client._lastChatSignature) signer.update(client._lastChatSignature)
      signer.update(concat('UUID', client.uuid))

      // Hash of chat body now opposed to signing plaintext. This lets server give us hashes for chat
      // chain without needing to reveal message contents
      if (message instanceof Buffer) {
        signer.update(message)
      } else {
        const hash = crypto.createHash('sha256')
        hash.update(concat('i64', salt, 'i64', timestamp / 1000n, 'pstring', message, 'i8', 70))
        if (preview) hash.update(preview)
        for (const previousMessage of client._lastSeenMessages) {
          hash.update(concat('i8', 70, 'UUID', previousMessage.sender))
          hash.update(previousMessage.signature)
        }
        // Feed hash back into signing payload
        signer.update(hash.digest())
      }

      client._lastChatSignature = signer.sign(client.profileKeys.private)
    } else {
      // 1.19
      const signable = concat('i64', salt, 'UUID', client.uuid, 'i64', timestamp / 1000n, 'pstring', JSON.stringify({ text: message }))
      client._lastChatSignature = crypto.sign('RSA-SHA256', signable, client.profileKeys.private)
    }

    return client._lastChatSignature
  }

  client.verifyMessage = (pubKey, packet) => {
    if (mcData.supportFeature('chainedChatWithHashing')) { // 1.19.1+
      // Verification handled internally in 1.19.1+ as previous messages must be stored to verify future messages
      throw new Error("Please listen to the 'playerChat' event instead to check message validity. client.verifyMessage is deprecated and only works on version 1.19.")
    }

    if (pubKey instanceof Buffer) pubKey = crypto.createPublicKey({ key: pubKey, format: 'der', type: 'spki' })
    const signable = concat('i64', packet.salt, 'UUID', packet.senderUuid, 'i64', packet.timestamp / 1000n, 'pstring', packet.signedChatContent)
    return crypto.verify('RSA-SHA256', signable, pubKey, packet.signature)
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

class LastSeenMessages extends Array {
  capacity = 5
  pending = 0
  push (e) {
    // Insert a new entry at the top and shift everything to the right
    let last = this[0]
    this[0] = e
    if (last && last.sender !== e.sender) {
      for (let i = 1; i < this.capacity; i++) {
        const current = this[i]
        this[i] = last
        last = current
        // If we found an existing entry for the sender ID, we can stop shifting
        if (!current || (current.sender === e.sender)) break
      }
    }
  }
}
