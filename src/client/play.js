const states = require('../states')
const signedChatPlugin = require('./chat')
const uuid = require('uuid-1345')

module.exports = function (client, options) {
  client.serverFeatures = {}
  client.on('server_data', (packet) => {
    client.serverFeatures = {
      chatPreview: packet.previewsChat,
      enforcesSecureChat: packet.enforcesSecureChat // in LoginPacket v>=1.20.5
    }
  })

  // Every login packet must start a fresh chat session (new session UUID, message
  // index 0) with the same profile key pair
  client.on('login', (packet) => {
    if (packet.enforcesSecureChat) client.serverFeatures.enforcesSecureChat = packet.enforcesSecureChat
    const mcData = require('minecraft-data')(client.version)
    if (mcData.supportFeature('useChatSessions') && client.profileKeys && client.cipher && client.session.selectedProfile.id === client.uuid.replace(/-/g, '')) {
      client._session = {
        index: 0,
        uuid: uuid.v4fast()
      }

      client.write('chat_session_update', {
        sessionUUID: client._session.uuid,
        expireTime: client.profileKeys ? BigInt(client.profileKeys.expiresOn.getTime()) : undefined,
        publicKey: client.profileKeys ? client.profileKeys.public.export({ type: 'spki', format: 'der' }) : undefined,
        signature: client.profileKeys ? client.profileKeys.signatureV2 : undefined
      })
    }
  })

  client.once('success', onLogin)

  function onLogin (packet) {
    const mcData = require('minecraft-data')(client.version)
    client.uuid = packet.uuid
    client.username = packet.username
    let sentClientInformation = false

    if (mcData.supportFeature('hasConfigurationState')) {
      client.write('login_acknowledged', {})
      enterConfigState(onReady)
      // Server can tell client to re-enter config state
      client.on('start_configuration', () => enterConfigState())
    } else {
      client.state = states.PLAY
      onReady()
    }

    function enterConfigState (finishCb) {
      if (client.state === states.CONFIGURATION) return
      // If we are returning to the configuration state from the play state, we ahve to acknowledge it.
      if (client.state === states.PLAY) {
        client.write('configuration_acknowledged', {})
      }
      client.state = states.CONFIGURATION
      // Brand then Client Information are sent once per connection, on the first entry
      // into configuration; re-entering configuration from play sends nothing else. Some
      // servers (e.g. Hypixel) close the socket unless Client Information arrives before
      // they send finish_configuration
      if (!sentClientInformation) {
        sentClientInformation = true
        client.write('custom_payload', {
          channel: 'minecraft:brand',
          data: client.serializer.proto.createPacketBuffer('string', options.brand ?? 'vanilla')
        })
        const clientSettings = options.clientSettings || {}
        client.write('settings', {
          locale: clientSettings.locale ?? 'en_us',
          viewDistance: clientSettings.viewDistance ?? 12,
          chatFlags: clientSettings.chatFlags ?? 0,
          chatColors: clientSettings.chatColors ?? true,
          skinParts: clientSettings.skinParts ?? 127,
          mainHand: clientSettings.mainHand ?? 1,
          enableTextFiltering: clientSettings.enableTextFiltering ?? false,
          enableServerListing: clientSettings.enableServerListing ?? true,
          particleStatus: clientSettings.particleStatus ?? 'all'
        })
      }
      // The server omits the registry entries of every pack in the reply, so a pack may
      // only be listed when its data is available locally
      client.once('select_known_packs', (packet) => {
        const knownPacks = options.knownPacks ?? []
        client.write('select_known_packs', {
          packs: packet.packs.filter(pack => knownPacks.some(known =>
            known.namespace === pack.namespace && known.id === pack.id && known.version === pack.version))
        })
      })
      client.once('code_of_conduct', () => {
        client.write('accept_code_of_conduct', {})
      })
      // Server should send finish_configuration on its own right after sending the client a dimension codec
      // for login (that has data about world height, world gen, etc) after getting a login success from client
      client.once('finish_configuration', () => {
        client.write('finish_configuration', {})
        client.state = states.PLAY
        finishCb?.()
      })
    }

    function onReady () {
      if (mcData.supportFeature('signedChat')) {
        if (options.disableChatSigning && client.serverFeatures.enforcesSecureChat) {
          throw new Error('"disableChatSigning" was enabled in client options, but server is enforcing secure chat')
        }
        signedChatPlugin(client, options)
      } else {
        client.on('chat', (packet) => {
          client.emit(packet.position === 0 ? 'playerChat' : 'systemChat', {
            formattedMessage: packet.message,
            sender: packet.sender,
            positionId: packet.position,
            verified: false
          })
        })
      }

      function unsignedChat (message) {
        client.write('chat', { message })
      }
      client.chat = client._signedChat || unsignedChat
      client.emit('playerJoin')
    }
  }
}
