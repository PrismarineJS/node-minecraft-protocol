var crypto = require('crypto');
var yggserver = require('yggdrasil').server({});
var ursa=require("../ursa");
var debug = require("../debug");

module.exports = function(client) {
  var options = client.options;
  client.once('encryption_begin', onEncryptionKeyRequest);

  function onEncryptionKeyRequest(packet) {
    crypto.randomBytes(16, gotSharedSecret);

    function gotSharedSecret(err, sharedSecret) {
      if(err) {
        debug(err);
        client.emit('error', err);
        client.end();
        return;
      }
      if(options.haveCredentials) {
        joinServerRequest(onJoinServerResponse);
      } else {
        if(packet.serverId != '-') {
          debug('This server appears to be an online server and you are providing no password, the authentication will probably fail');
        }
        sendEncryptionKeyResponse();
      }

      function onJoinServerResponse(err) {
        if(err) {
          client.emit('error', err);
          client.end();
        } else {
          sendEncryptionKeyResponse();
        }
      }

      function joinServerRequest(cb) {
        yggserver.join(options.accessToken, client.session.selectedProfile.id,
            packet.serverId, sharedSecret, packet.publicKey, cb);
      }

      function sendEncryptionKeyResponse() {
        var pubKey = mcPubKeyToURsa(packet.publicKey);
        var encryptedSharedSecretBuffer = pubKey.encrypt(sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = pubKey.encrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        client.write('encryption_begin', {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer
        });
        client.setEncryption(sharedSecret);
      }
    }
  }
};

function mcPubKeyToURsa(mcPubKeyBuffer) {
  var pem = "-----BEGIN PUBLIC KEY-----\n";
  var base64PubKey = mcPubKeyBuffer.toString('base64');
  var maxLineLength = 65;
  while(base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + "\n";
    base64PubKey = base64PubKey.substring(maxLineLength);
  }
  pem += "-----END PUBLIC KEY-----\n";
  return ursa.createPublicKey(pem, 'utf8');
}
