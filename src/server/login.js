const UUID = require('uuid-1345')
const bufferEqual = require('buffer-equal')
const crypto = require('crypto')
const pluginChannels = require('../client/pluginChannels')
const states = require('../states')
const yggdrasil = require('yggdrasil')
const { verifyPubKey, getKeyStringFromBytes } = require('../crypto')

module.exports = function (client, server, options) {
  const yggdrasilServer = yggdrasil.server({ agent: options.agent })
  const {
    'online-mode': onlineMode = true,
    kickTimeout = 30 * 1000,
    errorHandler: clientErrorHandler = (client, err) => client.end(err)
  } = options

  let serverId

  client.on('error', function (err) {
    clientErrorHandler(client, err)
  })
  client.on('end', () => {
    clearTimeout(loginKickTimer)
  })

  client.once('login_start', onLogin)

  let loginKickTimer = setTimeout(kickForNotLoggingIn, kickTimeout)

  function onLogin (packet) {
    client.username = packet.username
    const isException = !!server.onlineModeExceptions[client.username.toLowerCase()]
    const needToVerify = (onlineMode && !isException) || (!onlineMode && isException)
    if (needToVerify) {
      if (packet.crypto) {
        const { publicKey, expiresAt, signature } = packet.crypto
        const verifiablePubKey = getKeyStringFromBytes(publicKey, 'public', true)
        const verified = verifyPubKey(verifiablePubKey, expiresAt, signature, server.options?.crypto ?? {})
        if (!verified) {
          client.end('invalid public key signature')
          return
        }
        client.crypto = packet.crypto
      }
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
        serverId: serverId,
        publicKey: client.publicKey,
        verifyToken: client.verifyToken
      })
    } else {
      loginClient()
    }
  }

  function kickForNotLoggingIn () {
    client.end('LoginTimeout')
  }

  function onEncryptionKeyResponse (packet) {
    const mcData = require('minecraft-data')(client.version)

    let packetVerifyToken
    let signobj

    if (mcData.supportFeature('signatureEncryption')) {
      if (packet.hasVerifyToken) {
        packetVerifyToken = packet.crypto.verifyToken
      } else {
        signobj = packet.crypto
      }
    } else {
      packetVerifyToken = packet.verifyToken
    }

    // ensure the same auth method is used across the packets
    if (packetVerifyToken ^ !!client.crypto) {
      client.end('SwitchedAuthMethod')
      return
    }

    try {
      const key = server.serverKey.exportKey()
      const padding = crypto.constants.RSA_PKCS1_PADDING
      if (player.crypto) {
        const nonce = client.verifyToken
        const salt = signobj.salt
        const signature = signobj.signature
        const verify = crypto.createVerify('RSA-SHA256')
        verify.update(nonce)
        const saltBuf = Buffer.alloc(8)
        saltBuf.writeBigInt64BE(salt, 0)
        verify.update(saltBuf)
        const parsablePublicKey = getKeyStringFromBytes(client.crypto.publicKey)
        if (!verify.verify(parsablePublicKey)) {
          client.end('Certificate Signature invalid')
          return
        }
      } else {
        const verifyToken = crypto.privateDecrypt({ key, padding }, packetVerifyToken)
        if (!bufferEqual(client.verifyToken, verifyToken)) {
          client.end('DidNotEncryptVerifyTokenProperly')
          return
        }
      }
    } catch (e) {
      client.end('DidNotEncryptVerifyTokenProperly')
      return
    }
    const sharedSecret = crypto.privateDecrypt({ key, padding }, packet.sharedSecret)

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

  // https://github.com/openjdk-mirror/jdk7u-jdk/blob/f4d80957e89a19a29bb9f9807d2a28351ed7f7df/src/share/classes/java/util/UUID.java#L163
  function javaUUID (s) {
    const hash = crypto.createHash('md5')
    hash.update(s, 'utf8')
    const buffer = hash.digest()
    buffer[6] = (buffer[6] & 0x0f) | 0x30
    buffer[8] = (buffer[8] & 0x3f) | 0x80
    return buffer
  }

  function nameToMcOfflineUUID (name) {
    return (new UUID(javaUUID('OfflinePlayer:' + name))).toString()
  }

  function loginClient () {
    const isException = !!server.onlineModeExceptions[client.username.toLowerCase()]
    if (onlineMode === false || isException) {
      client.uuid = nameToMcOfflineUUID(client.username)
    }
    options.beforeLogin?.(client)
    if (client.protocolVersion >= 27) { // 14w28a (27) added whole-protocol compression (http://wiki.vg/Protocol_History#14w28a), earlier versions per-packet compressed TODO: refactor into minecraft-data
      client.write('compress', { threshold: 256 }) // Default threshold is 256
      client.compressionThreshold = 256
    }
    client.write('success', {
      uuid: client.uuid,
      username: client.username,
      properties: []
    })
    // TODO: find out what properties are on 'success' packet
    client.state = states.PLAY

    clearTimeout(loginKickTimer)
    loginKickTimer = null

    server.playerCount += 1
    client.once('end', function () {
      server.playerCount -= 1
    })
    pluginChannels(client, options)
    server.emit('login', client)
  }
}
