const crypto = require('crypto')
const concat = require('../transforms/binaryStream').concat
const { processNbtMessage } = require('prismarine-chat')
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

  // This stores the last n (5 or 20) messages that the player has seen, from unique players
  if (mcData.supportFeature('chainedChatWithHashing')) client._lastSeenMessages = new LastSeenMessages()
  else client._lastSeenMessages = new LastSeenMessagesWithInvalidation()
  // 1.20.3+ serializes chat components in either NBT or JSON. If the chat is sent as NBT, then the structure read will differ
  // from the normal JSON structure, so it needs to be normalized. prismarine-chat processNbtMessage will do that by default
  // on a fromNotch call. Since we don't call fromNotch here (done in mineflayer), we manually call processNbtMessage
  const processMessage = (msg) => mcData.supportFeature('chatPacketsUseNbtComponents') ? processNbtMessage(msg) : msg

  // This stores the last 128 inbound (signed) messages for 1.19.3 chat validation
  client._signatureCache = new SignatureCache()

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

  function updateAndValidateSession (uuid, message, currentSignature, index, previousMessages, salt, timestamp) {
    const player = client._players[uuid]

    if (player && player.hasChainIntegrity) {
      if (!player.lastSignature || player.lastSignature.equals(currentSignature) || index > player.sessionIndex) {
        player.lastSignature = currentSignature
        player.sessionIndex = index
      } else {
        player.hasChainIntegrity = false
      }

      if (player.hasChainIntegrity) {
        const length = Buffer.byteLength(message, 'utf8')
        const acknowledgements = previousMessages.length > 0 ? ['i32', previousMessages.length, 'buffer', Buffer.concat(...previousMessages.map(msg => msg.signature || client._signatureCache[msg.id]))] : ['i32', 0]

        const signable = concat('i32', 1, 'UUID', uuid, 'UUID', player.sessionUuid, 'i32', index, 'i64', salt, 'i64', timestamp / 1000n, 'i32', length, 'pstring', message, ...acknowledgements)

        player.hasChainIntegrity = crypto.verify('RSA-SHA256', signable, player.publicKey, currentSignature)
      }

      return player.hasChainIntegrity
    }

    return false
  }

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

  client.on('player_remove', (packet) => {
    for (const player of packet.players) {
      delete client._players[player.UUID]
    }
  })

  client.on('player_info', (packet) => {
    if (mcData.supportFeature('playerInfoActionIsBitfield')) { // 1.19.3+
      if (packet.action & 2) { // chat session
        for (const player of packet.data) {
          if (!player.chatSession) continue
          client._players[player.UUID] = {
            publicKey: crypto.createPublicKey({ key: player.chatSession.publicKey.keyBytes, format: 'der', type: 'spki' }),
            publicKeyDER: player.chatSession.publicKey.keyBytes,
            sessionUuid: player.chatSession.uuid
          }
          client._players[player.UUID].sessionIndex = true
          client._players[player.UUID].hasChainIntegrity = true
        }
      }

      return
    }

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

  client.on('profileless_chat', (packet) => {
    // Profileless chat is parsed as an unsigned player chat message but logged as a system message
    client.emit('playerChat', {
      formattedMessage: processMessage(packet.message),
      type: packet.type,
      senderName: processMessage(packet.name),
      targetName: processMessage(packet.target),
      verified: false
    })

    client._lastChatHistory.push({
      type: 2, // System message
      message: {
        decorated: packet.content // This should actually decorate the message with the sender and target name using the chat type
      },
      timestamp: Date.now()
    })
  })

  client.on('system_chat', (packet) => {
    client.emit('systemChat', {
      positionId: packet.isActionBar ? 2 : 1,
      formattedMessage: processMessage(packet.content)
    })

    client._lastChatHistory.push({
      type: 2, // System message
      message: {
        decorated: packet.content
      },
      timestamp: Date.now()
    })
  })

  client.on('message_header', (packet) => { // [1.19.2]
    updateAndValidateChat(packet.senderUuid, packet.previousSignature, packet.signature, packet.messageHash)

    client._lastChatHistory.push({
      type: 1, // Message header
      previousSignature: packet.previousSignature,
      signature: packet.signature,
      messageHash: packet.messageHash
    })
  })

  client.on('hide_message', (packet) => {
    if (mcData.supportFeature('useChatSessions')) {
      const signature = packet.signature || client._signatureCache[packet.id]
      if (signature) client._lastSeenMessages = client._lastSeenMessages.map(ack => (ack.signature === signature && ack.pending) ? null : ack)
    }
  })

  client.on('player_chat', (packet) => {
    if (mcData.supportFeature('useChatSessions')) {
      const tsDelta = BigInt(Date.now()) - packet.timestamp
      const expired = !packet.timestamp || tsDelta > messageExpireTime || tsDelta < 0
      const verified = !packet.unsignedChatContent && updateAndValidateSession(packet.senderUuid, packet.plainMessage, packet.signature, packet.index, packet.previousMessages, packet.salt, packet.timestamp) && !expired
      if (verified) client._signatureCache.push(packet.signature)
      client.emit('playerChat', {
        plainMessage: packet.plainMessage,
        unsignedContent: processMessage(packet.unsignedChatContent),
        type: packet.type,
        sender: packet.senderUuid,
        senderName: processMessage(packet.networkName),
        targetName: processMessage(packet.networkTargetName),
        verified
      })

      client._lastChatHistory.push({
        type: 0, // Player message
        signature: packet.signature,
        message: {
          plain: packet.plainMessage
        },
        session: {
          index: packet.index,
          uuid: client._players[packet.senderUuid]?.sessionUuid
        },
        timestamp: packet.timestamp,
        salt: packet.salt,
        lastSeen: packet.previousMessages.map(msg => msg.signature || client._signatureCache[msg.id])
      })

      if (client._lastSeenMessages.push(packet.signature) && client._lastSeenMessages.pending > 64) {
        client.write('message_acknowledgement', {
          count: client._lastSeenMessages.pending
        })
        client._lastSeenMessages.pending = 0
      }
      return
    }

    if (mcData.supportFeature('chainedChatWithHashing')) {
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
      const verified = !packet.unsignedChatContent && updateAndValidateChat(packet.senderUuid, packet.previousSignature, packet.signature, hash.digest()) && !expired
      client.emit('playerChat', {
        plainMessage: packet.plainMessage,
        unsignedContent: packet.unsignedChatContent,
        formattedMessage: packet.formattedMessage,
        type: packet.type,
        sender: packet.senderUuid,
        senderName: packet.networkName,
        targetName: packet.networkTargetName,
        verified
      })

      // We still accept a message (by pushing to seenMessages) even if the chain is broken. A vanilla client
      // will reject a message if the client sets secure chat to be required and the message from the server
      // isn't signed, or the client has blocked the sender.
      // client1.19.1/client/net/minecraft/client/multiplayer/ClientPacketListener.java#L768
      client._lastChatHistory.push({
        type: 0, // Player message
        previousSignature: packet.previousSignature,
        signature: packet.signature,
        message: {
          plain: packet.plainMessage,
          decorated: packet.formattedMessage
        },
        messageHash: packet.messageHash,
        timestamp: packet.timestamp,
        salt: packet.salt,
        lastSeen: packet.previousMessages
      })

      if (client._lastSeenMessages.push({ sender: packet.senderUuid, signature: packet.signature }) && client._lastSeenMessages.pending++ > 64) {
        client.write('message_acknowledgement', {
          previousMessages: client._lastSeenMessages.map((e) => ({
            messageSender: e.sender,
            messageSignature: e.signature
          })),
          lastRejectedMessage: client._lastRejectedMessage
        })
        client._lastSeenMessages.pending = 0
      }

      return
    }

    const pubKey = client._players[packet.senderUuid]?.publicKey
    client.emit('playerChat', {
      formattedMessage: packet.signedChatContent || packet.unsignedChatContent,
      type: packet.type,
      sender: packet.senderUuid,
      senderName: packet.senderName,
      senderTeam: packet.senderTeam,
      verified: (pubKey && !packet.unsignedChatContent) ? client.verifyMessage(pubKey, packet) : false
    })
  })

  const sliceIndexForMessage = {}
  client.on('declare_commands', (packet) => {
    const nodes = packet.nodes
    for (const commandNode of nodes[0].children) {
      const node = nodes[commandNode]
      const commandName = node.extraNodeData.name
      function visit (node, depth = 0) {
        const name = node.extraNodeData.name
        if (node.extraNodeData.parser === 'minecraft:message') {
          sliceIndexForMessage[commandName] = [name, depth]
        }
        for (const child of node.children) {
          visit(nodes[child], depth + 1)
        }
      }
      visit(node, 0)
    }
  })

  function signaturesForCommand (string, ts, salt, preview, acknowledgements) {
    const signatures = []
    const slices = string.split(' ')
    if (sliceIndexForMessage[slices[0]]) {
      const [fieldName, sliceIndex] = sliceIndexForMessage[slices[0]]
      const sliced = slices.slice(sliceIndex)
      if (sliced.length > 0) {
        const signable = sliced.join(' ')
        signatures.push({ argumentName: fieldName, signature: client.signMessage(signable, ts, salt, preview, acknowledgements) })
      }
    }
    return signatures
  }

  // Chat Sending
  let pendingChatRequest
  let lastPreviewRequestId = 0

  function getAcknowledgements () {
    let acc = 0
    const acknowledgements = []

    for (let i = 0; i < client._lastSeenMessages.capacity; i++) {
      const idx = (client._lastSeenMessages.offset + i) % 20
      const message = client._lastSeenMessages[idx]
      if (message) {
        acc |= 1 << i
        acknowledgements.push(message.signature)
        message.pending = false
      }
    }

    const bitset = Buffer.allocUnsafe(3)
    bitset[0] = acc & 0xFF
    bitset[1] = (acc >> 8) & 0xFF
    bitset[2] = (acc >> 16) & 0xFF

    return {
      acknowledgements,
      acknowledged: bitset
    }
  }

  client._signedChat = (message, options = {}) => {
    options.timestamp = options.timestamp || BigInt(Date.now())
    options.salt = options.salt || 1n

    if (message.startsWith('/')) {
      const command = message.slice(1)
      if (mcData.supportFeature('useChatSessions')) { // 1.19.3+
        const { acknowledged, acknowledgements } = getAcknowledgements()
        const canSign = client.profileKeys && client._session
        client.write((mcData.supportFeature('seperateSignedChatCommandPacket') && canSign) ? 'chat_command_signed' : 'chat_command', {
          command,
          timestamp: options.timestamp,
          salt: options.salt,
          argumentSignatures: canSign ? signaturesForCommand(command, options.timestamp, options.salt, options.preview, acknowledgements) : [],
          messageCount: client._lastSeenMessages.pending,
          acknowledged
        })
        client._lastSeenMessages.pending = 0
      } else {
        client.write('chat_command', {
          command,
          timestamp: options.timestamp,
          salt: options.salt,
          argumentSignatures: client.profileKeys ? signaturesForCommand(command, options.timestamp, options.salt) : [],
          signedPreview: options.didPreview,
          previousMessages: client._lastSeenMessages.map((e) => ({
            messageSender: e.sender,
            messageSignature: e.signature
          })),
          lastRejectedMessage: client._lastRejectedMessage
        })
      }

      return
    }

    if (mcData.supportFeature('useChatSessions')) {
      const { acknowledgements, acknowledged } = getAcknowledgements()
      client.write('chat_message', {
        message,
        timestamp: options.timestamp,
        salt: options.salt,
        signature: (client.profileKeys && client._session) ? client.signMessage(message, options.timestamp, options.salt, undefined, acknowledgements) : undefined,
        offset: client._lastSeenMessages.pending,
        acknowledged
      })
      client._lastSeenMessages.pending = 0

      return
    }

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
    } else if (client.serverFeatures.chatPreview) {
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
  client.signMessage = (message, timestamp, salt = 0, preview, acknowledgements) => {
    if (!client.profileKeys) throw Error("Can't sign message without profile keys, please set valid auth mode")

    if (mcData.supportFeature('useChatSessions')) {
      if (!client._session.uuid) throw Error("Chat session not initialized. Can't send chat")

      const length = Buffer.byteLength(message, 'utf8')
      const previousMessages = acknowledgements.length > 0 ? ['i32', acknowledgements.length, 'buffer', Buffer.concat(acknowledgements)] : ['i32', 0]

      const signable = concat('i32', 1, 'UUID', client.uuid, 'UUID', client._session.uuid, 'i32', client._session.index++, 'i64', salt, 'i64', timestamp / 1000n, 'i32', length, 'pstring', message, ...previousMessages)
      return crypto.sign('RSA-SHA256', signable, client.profileKeys.private)
    } else if (mcData.supportFeature('chainedChatWithHashing')) {
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

class SignatureCache extends Array {
  capacity = 128
  index = 0

  push (e) {
    if (!e) return

    this[this.index++] = e
    this.index %= this.capacity
  }
}

class LastSeenMessagesWithInvalidation extends Array {
  capacity = 20
  offset = 0
  pending = 0

  push (e) {
    if (!e) return false

    this[this.offset] = { pending: true, signature: e }
    this.offset = (this.offset + 1) % this.capacity
    this.pending++
    return true
  }
}

class LastSeenMessages extends Array {
  capacity = 5
  pending = 0

  push (e) {
    if (!e || !e.signature || e.signature.length === 0) return false // We do not acknowledge unsigned messages

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
    return true
  }
}
