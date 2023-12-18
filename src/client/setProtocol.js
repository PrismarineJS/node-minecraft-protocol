'use strict'

const states = require('../states')

module.exports = function (client, options) {
  client.on('connect', onConnect)

  function onConnect () {
    if (client.wait_connect) {
      client.on('connect_allowed', next)
    } else {
      next()
    }

    function next () {
      const mcData = require('minecraft-data')(client.version)
      let taggedHost = options.host
      if (client.tagHost) taggedHost += client.tagHost
      if (options.fakeHost) taggedHost = options.fakeHost

      client.write('set_protocol', {
        protocolVersion: options.protocolVersion,
        serverHost: taggedHost,
        serverPort: options.port,
        nextState: 2
      })
      client.state = states.LOGIN
      client.write('login_start', {
        username: client.username,
        signature: (client.profileKeys && !mcData.supportFeature('useChatSessions'))
          ? {
              timestamp: BigInt(client.profileKeys.expiresOn.getTime()), // should probably be called "expireTime"
              // Remove padding on the public key: not needed in vanilla server but matches how vanilla client looks
              publicKey: client.profileKeys.public.export({ type: 'spki', format: 'der' }),
              signature: mcData.supportFeature('profileKeySignatureV2')
                ? client.profileKeys.signatureV2
                : client.profileKeys.signature
            }
          : null,
        playerUUID: client.session?.selectedProfile?.id ?? client.uuid
      })
    }
  }
}
