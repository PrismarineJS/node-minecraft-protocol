'use strict'

const crypto = require('crypto')
const debug = require('debug')('minecraft-protocol')
const yggdrasil = require('yggdrasil')
const { salt, getKeyStringFromBytes } = require('../crypto')

module.exports = function (client, options) {
  const yggdrasilServer = yggdrasil.server({ agent: options.agent, host: options.sessionServer || 'https://sessionserver.mojang.com' })
  client.once('encryption_begin', onEncryptionKeyRequest)

  function onEncryptionKeyRequest (packet) {
    crypto.randomBytes(16, gotSharedSecret)

    function gotSharedSecret (err, sharedSecret) {
      if (err) {
        debug(err)
        client.emit('error', err)
        client.end('encryptionSecretError')
        return
      }
      if (options.haveCredentials) {
        joinServerRequest(onJoinServerResponse)
      } else {
        if (packet.serverId !== '-') {
          debug('This server appears to be an online server and you are providing no password, the authentication will probably fail')
        }
        sendEncryptionKeyResponse()
      }

      function onJoinServerResponse (err) {
        if (err) {
          client.emit('error', err)
          client.end('encryptionLoginError')
        } else {
          sendEncryptionKeyResponse()
        }
      }

      function joinServerRequest (cb) {
        yggdrasilServer.join(options.accessToken, client.session.selectedProfile.id,
          packet.serverId, sharedSecret, packet.publicKey, cb)
      }

      function sendEncryptionKeyResponse () {
        const mcData = require('minecraft-data')(client.version)

        const pubKey = getKeyStringFromBytes(packet.publicKey)
        const encryptedSharedSecretBuffer = crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, sharedSecret)
        const makeEncryptedVerifyTokenBuffer = () => crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, packet.verifyToken)

        if (mcData.supportFeature('signatureEncryption')) {
          let crypto
          if (client.crypto) {
            const l = salt()
            const signer = crypto.createSigner('SHA-1')
            signer.update(packet.verifyToken)
            signer.update(l)
            const clientPrivateKey = client.crypto.keyPair.privateKey.replace('RSA ', '')
            crypto = { salt: l, signature: signer.sign(privKey) }
          } else {
            crypto = { verifyToken: makeEncryptedVerifyTokenBuffer() }
          }
          client.write('encryption_begin', {
            sharedSecret: encryptedSharedSecretBuffer,
            hasVerifyToken: !client.crypto,
            crypto
          })
        } else {
          client.write('encryption_begin', {
            sharedSecret: encryptedSharedSecretBuffer,
            verifyToken: makeEncryptedVerifyTokenBuffer()
          })
        }
        client.setEncryption(sharedSecret)
      }
    }
  }
}
