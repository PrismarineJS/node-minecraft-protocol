const states = require('../states')
const CHAT_PREVIEW_MODES = require('./chatPreviewModes')

module.exports = (client, options) => {
  const mcData = require('minecraft-data')(client.version)
  const players = {} // 1.19+
  client.previewId = 0
  client.lastPreviewTime = 0
  client.msgAwaitingChatPreview = null

  function onChat (packet, isMessageFromServer = false) {
    let message = packet.message ?? packet.unsignedChatContent ?? packet.signedChatContent
    if (isMessageFromServer) message = packet.content

    let verified = isMessageFromServer ? null : false // default to false if this is a system chat
    if (!isMessageFromServer && client.profileKeys != null && packet.signature) {
      verified = client.verifyMessage(players[packet.senderUuid].publicKey, packet)
    }
    client.emit('chat_received', { verified, message, isMessageFromServer })
  }

  client.on('chat', packet => onChat(packet))
  client.on('player_chat', packet => onChat(packet))
  client.on('system_chat', packet => onChat(packet, true))
  client.on('player_info', packet => {
    if (packet.action === 0) {
      // add player
      for (const player of packet.data) {
        players[player.UUID] = player.crypto
      }
    }
  })

  client.on('state', function (newState) {
    if (newState === states.PLAY) {
      client.chat = message => sendChatMessage(mcData, client, message)
    }
  })
}

const EMPTY_BUFFER = Buffer.from([])

async function sendChatMessage (mcData, client, message) {
  if (mcData.supportFeature('signedChat')) {
    const timestamp = BigInt(Date.now())
    if (client.chatPreviewMode === CHAT_PREVIEW_MODES.OFF) {
      console.log("server doesn't preview chat")
      clearPreview(client)
    } else {
      if (message.startsWith('/')) {
        // TODO: Implement
        throw new Error('commands are unimplemented')
      } else {
        const normalizedMsg = trimAndRemoveRepeatedSpaces(message)
        if (normalizedMsg.length !== 0 && client.lastPreviewedMsg !== normalizedMsg) {
          client.lastPreviewedMsg = normalizedMsg
          await requestChatPreview(client, message)
        } else {
          clearPreview(client)
        }
        // await preview reply
      }
    }
    return
    client.write('chat_message', {
      message,
      timestamp,
      salt: 0,
      signature: client.profileKeys != null ? EMPTY_BUFFER : client.signMessage(message, timestamp)
    })
  } else {
    client.write('chat', { message })
  }
}

const { once } = require('events')

async function requestChatPreview (client, msg) {
  if (maybeTryPreviewMessage(client, msg)) {
    console.log('did request')
    client.msgAwaitingChatPreview = msg
    const [data] = await once(client, 'chat_preview')
    console.log('requested preview')
    console.log(data)
  } else {
    console.log('didnt')
  }
}

function randomIntFromInterval (min, max) { // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// returns whether we previewed the message
function maybeTryPreviewMessage (client, msg) {
  if (client.msgAwaitingChatPreview === msg) {
    return true
  }

  const nowMs = Date.now()

  if (nowMs >= client.lastPreviewTime + 100 &&
    (client.msgAwaitingChatPreview === null || nowMs >= client.lastPreviewTime + 1000)) {
    client.lastPreviewTime = nowMs
    client.previewId += randomIntFromInterval(1, 100)
    console.log('sent request:', {
      query: client.previewId,
      message: msg
    })
    client.write('chat_preview', {
      query: client.previewId,
      message: msg
    })
    return true
  }
  return false
}

function trimAndRemoveRepeatedSpaces (str) {
  return str.trim().replace(/\s+/g, ' ')
}

function clearPreview (client) {
  client.lastPreviewedMsg = null
  client.msgAwaitingChatPreview = null
  client.lastPreviewResponse = null
  // client.currentPreviewRequest = null
  client.lastPreviewTime = 0
}
