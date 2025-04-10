'use strict'

const crypto = require('crypto')
const debug = require('debug')('minecraft-protocol')
const yggdrasil = require('yggdrasil')
const { concat } = require('../transforms/binaryStream')

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

        const pubKey = mcPubKeyToPem(packet.publicKey)
        const encryptedSharedSecretBuffer = crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, sharedSecret)
        const encryptedVerifyTokenBuffer = crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, packet.verifyToken)

        if (mcData.supportFeature('signatureEncryption')) {
          const salt = BigInt(Date.now())
          client.write('encryption_begin', {
            sharedSecret: encryptedSharedSecretBuffer,
            hasVerifyToken: client.profileKeys == null,
            crypto: client.profileKeys
              ? {
                  salt,
                  messageSignature: crypto.sign('sha256WithRSAEncryption',
                    concat('buffer', packet.verifyToken, 'i64', salt), client.profileKeys.private)
                }
              : {
                  verifyToken: encryptedVerifyTokenBuffer
                }
          })
        } else {
          client.write('encryption_begin', {
            sharedSecret: encryptedSharedSecretBuffer,
            verifyToken: encryptedVerifyTokenBuffer
          })
        }
        client.setEncryption(sharedSecret)
      }
    }
  }
}

function mcPubKeyToPem (mcPubKeyBuffer) {
  let pem = '-----BEGIN PUBLIC KEY-----\n'
  let base64PubKey = mcPubKeyBuffer.toString('base64')
  const maxLineLength = 64
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + '\n'
    base64PubKey = base64PubKey.substring(maxLineLength)
  }
  pem += '-----END PUBLIC KEY-----\n'
  return pem
}
