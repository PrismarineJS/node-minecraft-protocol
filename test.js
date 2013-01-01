var Parser = require('./lib/parser')
  , ursa = require('ursa')
  , crypto = require('crypto')
  , assert = require('assert')

var parser = new Parser();
parser.on('connect', function() {
  console.info("connect");
  parser.writePacket(Parser.HANDSHAKE, {
    protocolVersion: 51,
    userName: 'superjoe30',
    serverHost: 'localhost',
    serverPort: 25565,
  });
});
parser.on('packet', function(packet) {
  var handler = packetHandlers[packet.id];
  if (handler) {
    handler(packet);
  } else {
    console.warn("No packet handler for", packet.id, "fields", packet);
  }
});
parser.on('error', function(err) {
  console.error("error connecting", err.stack);
});
parser.on('end', function() {
  console.info("disconnect");
});
parser.connect(25565, 'localhost');

var packetHandlers = {
  0xFC: onEncryptionKeyResponse,
  0xFD: onEncryptionKeyRequest,
};

function onEncryptionKeyRequest(packet) {
  console.log("enc key request");
  crypto.randomBytes(16, function (err, sharedSecret) {
    assert.ifError(err);
    var pubKey = mcPubKeyToURsa(packet.publicKey);
    var encryptedSharedSecret = pubKey.encrypt(sharedSecret, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
    var encryptedSharedSecretBuffer = new Buffer(encryptedSharedSecret, 'base64');
    var encryptedVerifyToken = pubKey.encrypt(packet.verifyToken, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
    var encryptedVerifyTokenBuffer = new Buffer(encryptedVerifyToken, 'base64');
    console.log("write enc key response");
    parser.writePacket(Parser.ENCRYPTION_KEY_RESPONSE, {
      sharedSecret: encryptedSharedSecretBuffer,
      verifyToken: encryptedVerifyTokenBuffer,
    });
  });
}

function onEncryptionKeyResponse(packet) {
  console.log("confirmation enc key response");
  assert.strictEqual(packet.sharedSecret.length, 0);
  assert.strictEqual(packet.verifyToken.length, 0);
  // TODO: enable AES encryption, then we can do the below line
  //parser.writePacket(Parser.CLIENT_STATUSES, { payload: 0 });
}

function mcPubKeyToURsa(mcPubKeyBuffer) {
  var pem = "-----BEGIN PUBLIC KEY-----\n";
  var base64PubKey = mcPubKeyBuffer.toString('base64');
  var maxLineLength = 65;
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + "\n";
    base64PubKey = base64PubKey.substring(maxLineLength);
  }
  pem += "-----END PUBLIC KEY-----\n";
  return ursa.createPublicKey(pem, 'utf8');
}
