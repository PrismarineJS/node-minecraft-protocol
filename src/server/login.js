const uuid = require('../datatypes/uuid')
const crypto = require('crypto')
const pluginChannels = require('../client/pluginChannels')
const states = require('../states')
const yggdrasil = require('yggdrasil')
const chatPlugin = require('./chat')
const { concat } = require('../transforms/binaryStream')
const { mojangPublicKeyPem } = require('./constants')
const debug = require('debug')('minecraft-protocol')
const NodeRSA = require('node-rsa')
const nbt = require('prismarine-nbt')

/**
 * @param {import('../index').Client} client
 * @param {import('../index').Server} server
 * @param {Object} options
 */
module.exports = function (client, server, options) {
  const mojangPubKey = crypto.createPublicKey(mojangPublicKeyPem)
  const raise = (translatableError) => client.end(translatableError, JSON.stringify({ translate: translatableError }))
  const yggdrasilServer = yggdrasil.server({ agent: options.agent })
  const {
    'online-mode': onlineMode = true,
    kickTimeout = 30 * 1000,
    errorHandler: clientErrorHandler = function (client, err) {
      if (!options.hideErrors) console.debug('Disconnecting client because error', err)
      client.end(err)
    }
  } = options

  let serverId

  client.on('error', function (err) {
    clientErrorHandler(client, err)
  })
  client.on('end', () => {
    clearTimeout(loginKickTimer)
  })
  client.once('login_start', onLogin)

  function kickForNotLoggingIn () {
    client.end('LoginTimeout')
  }
  let loginKickTimer = setTimeout(kickForNotLoggingIn, kickTimeout)

  function onLogin (packet) {
    const mcData = require('minecraft-data')(client.version)
    client.supportFeature = mcData.supportFeature

    client.username = packet.username
    const isException = !!server.onlineModeExceptions[client.username.toLowerCase()]
    const needToVerify = (onlineMode && !isException) || (!onlineMode && isException)

    if (mcData.supportFeature('signatureEncryption')) {
      if (options.enforceSecureProfile && !packet.signature) {
        raise('multiplayer.disconnect.missing_public_key')
        return
      }
    }

    if (packet.signature) {
      if (packet.signature.timestamp < BigInt(Date.now())) {
        debug('Client sent expired tokens')
        raise('multiplayer.disconnect.invalid_public_key_signature')
        return // expired tokens, client needs to restart game
      }

      try {
        const publicKey = crypto.createPublicKey({ key: packet.signature.publicKey, format: 'der', type: 'spki' })
        const signable = mcData.supportFeature('profileKeySignatureV2')
          ? concat('UUID', packet.playerUUID, 'i64', packet.signature.timestamp, 'buffer', publicKey.export({ type: 'spki', format: 'der' }))
          : Buffer.from(packet.signature.timestamp + mcPubKeyToPem(packet.signature.publicKey), 'utf8') // (expires at + publicKey)

        // This makes sure 'signable' when signed with the mojang private key equals signature in this packet
        if (!crypto.verify('RSA-SHA1', signable, mojangPubKey, packet.signature.signature)) {
          debug('Signature mismatch')
          raise('multiplayer.disconnect.invalid_public_key_signature')
          return
        }
        client.profileKeys = { public: publicKey }
      } catch (err) {
        debug(err)
        raise('multiplayer.disconnect.invalid_public_key')
        return
      }
    }

    if (needToVerify) {
      serverId = crypto.randomBytes(4).toString('hex')
      client.verifyToken = crypto.randomBytes(4)
      const publicKeyStrArr = server.serverKey.exportKey('pkcs8-public-pem').split('\n')
      let publicKeyStr = ''
      for (let i = 1; i < publicKeyStrArr.length - 1; i++) {
        publicKeyStr += publicKeyStrArr[i]
      }
      client.publicKey = Buffer.from(publicKeyStr, 'base64')
      client.once('encryption_begin', onEncryptionKeyResponse)
      client.write('encryption_begin', {
        serverId,
        publicKey: client.publicKey,
        verifyToken: client.verifyToken
      })
    } else {
      loginClient()
    }
  }

  function onEncryptionKeyResponse (packet) {
    if (client.profileKeys) {
      if (options.enforceSecureProfile && packet.hasVerifyToken) {
        raise('multiplayer.disconnect.missing_public_key')
        return // Unexpected - client has profile keys, and we expect secure profile
      }
    }

    const keyRsa = new NodeRSA(server.serverKey.exportKey('pkcs1'), 'private', { encryptionScheme: 'pkcs1' })
    keyRsa.setOptions({ environment: 'browser' })

    if (packet.hasVerifyToken === false) {
      // 1.19, hasVerifyToken is set and equal to false IF chat signing is enabled
      // This is the default action starting in 1.19.1.
      const signable = concat('buffer', client.verifyToken, 'i64', packet.crypto.salt)
      if (!crypto.verify('sha256WithRSAEncryption', signable, client.profileKeys.public, packet.crypto.messageSignature)) {
        raise('multiplayer.disconnect.invalid_public_key_signature')
        return
      }
    } else {
      const encryptedToken = packet.hasVerifyToken ? packet.crypto.verifyToken : packet.verifyToken
      try {
        const decryptedToken = keyRsa.decrypt(encryptedToken)

        if (!client.verifyToken.equals(decryptedToken)) {
          client.end('DidNotEncryptVerifyTokenProperly')
          return
        }
      } catch {
        client.end('DidNotEncryptVerifyTokenProperly')
        return
      }
    }
    let sharedSecret
    try {
      sharedSecret = keyRsa.decrypt(packet.sharedSecret)
    } catch (e) {
      client.end('DidNotEncryptVerifyTokenProperly')
      return
    }

    client.setEncryption(sharedSecret)

    const isException = !!server.onlineModeExceptions[client.username.toLowerCase()]
    const needToVerify = (onlineMode && !isException) || (!onlineMode && isException)
    const nextStep = needToVerify ? verifyUsername : loginClient
    nextStep()

    function verifyUsername () {
      yggdrasilServer.hasJoined(client.username, serverId, sharedSecret, client.publicKey, function (err, profile) {
        if (err) {
          client.end('Failed to verify username!')
          return
        }
        // Convert to a valid UUID until the session server updates and does
        // it automatically
        client.uuid = profile.id.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5')
        client.username = profile.name
        client.profile = profile
        loginClient()
      })
    }
  }

  function loginClient () {
    const isException = !!server.onlineModeExceptions[client.username.toLowerCase()]
    if (onlineMode === false || isException) {
      client.uuid = uuid.nameToMcOfflineUUID(client.username)
    }
    options.beforeLogin?.(client)
    if (client.protocolVersion >= 27) { // 14w28a (27) added whole-protocol compression (http://wiki.vg/Protocol_History#14w28a), earlier versions per-packet compressed TODO: refactor into minecraft-data
      client.write('compress', { threshold: 256 }) // Default threshold is 256
      client.compressionThreshold = 256
    }
    // TODO: find out what properties are on 'success' packet
    client.write('success', {
      uuid: client.uuid,
      username: client.username,
      properties: []
    })
    if (client.supportFeature('hasConfigurationState')) {
      client.once('login_acknowledged', onClientLoginAck)
    } else {
      client.state = states.PLAY
      server.emit('playerJoin', client)
    }
    client.settings = {}

    if (client.supportFeature('chainedChatWithHashing')) { // 1.19.1+
      const jsonMotd = JSON.stringify(server.motdMsg ?? { text: server.motd })
      const nbtMotd = nbt.comp({ text: nbt.string(server.motd) })
      client.write('server_data', {
        motd: client.supportFeature('chatPacketsUseNbtComponents') ? nbtMotd : jsonMotd,
        icon: server.favicon, // b64
        iconBytes: server.favicon ? Buffer.from(server.favicon, 'base64') : undefined,
        previewsChat: options.enableChatPreview,
        // Note: in 1.20.5+ user must send this with `login`
        enforcesSecureChat: options.enforceSecureProfile
      })
    }

    clearTimeout(loginKickTimer)
    loginKickTimer = null

    server.playerCount += 1
    client.once('end', function () {
      server.playerCount -= 1
    })
    pluginChannels(client, options)
    if (client.supportFeature('signedChat')) chatPlugin(client, server, options)
    server.emit('login', client)
  }

  function onClientLoginAck () {
    client.state = states.CONFIGURATION
    if (client.supportFeature('segmentedRegistryCodecData')) {
      for (const key in options.registryCodec) {
        const entry = options.registryCodec[key]
        client.write('registry_data', entry)
      }
    } else {
      client.write('registry_data', { codec: options.registryCodec || {} })
    }
    client.once('finish_configuration', () => {
      client.state = states.PLAY
      server.emit('playerJoin', client)
    })
    client.write('finish_configuration', {})
  }
}

function mcPubKeyToPem (mcPubKeyBuffer) {
  let pem = '-----BEGIN RSA PUBLIC KEY-----\n'
  let base64PubKey = mcPubKeyBuffer.toString('base64')
  const maxLineLength = 76
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + '\n'
    base64PubKey = base64PubKey.substring(maxLineLength)
  }
  pem += '-----END RSA PUBLIC KEY-----\n'
  return pem
}
