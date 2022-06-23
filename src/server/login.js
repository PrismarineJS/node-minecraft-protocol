const UUID = require('uuid-1345')
const bufferEqual = require('buffer-equal')
const crypto = require('crypto')
const pluginChannels = require('../client/pluginChannels')
const states = require('../states')
const yggdrasil = require('yggdrasil')

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
    let sharedSecret
    try {
      const verifyToken = crypto.privateDecrypt({ key: server.serverKey.exportKey(), padding: crypto.constants.RSA_PKCS1_PADDING }, packet.verifyToken)
      if (!bufferEqual(client.verifyToken, verifyToken)) {
        client.end('DidNotEncryptVerifyTokenProperly')
        return
      }
      sharedSecret = crypto.privateDecrypt({ key: server.serverKey.exportKey(), padding: crypto.constants.RSA_PKCS1_PADDING }, packet.sharedSecret)
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
    client.write('success', { uuid: client.uuid, username: client.username })
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
