const states = require('../states')
const signedChatPlugin = require('./chat')
const uuid = require('uuid-1345')

module.exports = function (client, options) {
  client.serverFeatures = {}
  client.on('server_data', (packet) => {
    client.serverFeatures = {
      chatPreview: packet.previewsChat,
      enforcesSecureChat: packet.enforcesSecureChat
    }
  })

  client.once('login', () => {
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
    if (mcData.supportFeature('hasConfigurationState')) {
      require('../datatypes/minecraft').setNbtToNetwork() // https://wiki.vg/NBT#Network_NBT_.28Java_Edition.29
      client.write('login_acknowledged', {})
      client.state = states.CONFIGURATION
    } else {
      client.state = states.PLAY
      enableChat()
    }
  }
  
  client.once('finish_configuration', onFinishConfiguration)
  
  function onFinishConfiguration (packet) {
    const mcData = require('minecraft-data')(client.version)
    if (!mcData.supportFeature('hasConfigurationState'))
      return;
    
    client.write('finish_configuration', {})
    client.state = states.PLAY
    enableChat()
  }
  
  function enableChat() {
    const mcData = require('minecraft-data')(client.version)
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
  }
}
