var Parser = require('./lib/parser')
  , ursa = require('ursa')
  , crypto = require('crypto')
  , assert = require('assert')
  , superagent = require('superagent')

var input = {
  email: process.env.MC_EMAIL,
  password: process.env.MC_PASSWORD,
  serverHost: 'localhost',
  serverPort: 25565,
};

var parser = new Parser();
var loginSession = null;
parser.on('connect', function() {
  console.info("connect");
  parser.writePacket(Parser.HANDSHAKE, {
    protocolVersion: 51,
    username: loginSession.username,
    serverHost: input.serverHost,
    serverPort: input.serverPort,
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

getLoginSession(function() {
  parser.connect(input.serverPort, input.serverHost);
});

function getLoginSession(cb) {
  console.log("logging in to minecraft.net");
  var req = superagent.post("https://login.minecraft.net");
  req.type('form');
  req.send({
    user: input.email,
    password: input.password,
    version: 13,
  });
  req.end(function(err, resp) {
    if (err) {
      cb(err);
    } else if (! resp.ok) {
      cb(new Error("login.minecraft.net status " + resp.status + ": " + resp.text));
    } else {
      var values = resp.text.split(':');
      var session = {
        currentGameVersion: values[0],
        username: values[2],
        id: values[3],
        uid: values[4],
      };
      if (session.id && session.username) {
        loginSession = session;
        console.info("logged in as", session.username);
        cb();
      } else {
        cb(new Error("login.minecraft.net says " + session.currentGameVersion));
      }
    }
  });
}

var packetHandlers = {
  0x00: onKeepAlive,
  0x01: onLoginRequest,
  0x03: onChatMessage,
  0xFC: onEncryptionKeyResponse,
  0xFD: onEncryptionKeyRequest,
  0xFF: onKick,
};

function onKeepAlive(packet) {
  parser.writePacket(Parser.KEEP_ALIVE, {
    keepAliveId: packet.keepAliveId
  });
}

function onKick(packet) {
  console.log("kick", packet);
}

function onLoginRequest(packet) {
  console.log("login request", packet);
}

function onChatMessage(packet) {
  console.log("chat message", packet);
  if (packet.message.indexOf(loginSession.username) === -1) {
    parser.writePacket(Parser.CHAT_MESSAGE, {
      message: packet.message,
    });
  }
}

function onEncryptionKeyRequest(packet) {
  console.log("enc key request");
  var hash = crypto.createHash('sha1');
  hash.update(packet.serverId);
  crypto.randomBytes(16, function (err, sharedSecret) {
    assert.ifError(err);
    hash.update(sharedSecret);
    hash.update(packet.publicKey);
    var digest = mcHexDigest(hash);
    var request = superagent.get("http://session.minecraft.net/game/joinserver.jsp");

    request.query({
      user: loginSession.username,
      sessionId: loginSession.id,
      serverId: digest,
    });
    request.end(function(err, resp) {
      if (err) {
        console.error("session.minecraft.net not available");
        // TODO emit error
      } else if (! resp.ok) {
        console.error("session.minecraft.net returned error:", resp.status, resp.text);
        // TODO emit error
      } else {
        sendEncryptionKeyResponse();
      }
    });

    function sendEncryptionKeyResponse() {
      var pubKey = mcPubKeyToURsa(packet.publicKey);
      var encryptedSharedSecret = pubKey.encrypt(sharedSecret, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
      var encryptedSharedSecretBuffer = new Buffer(encryptedSharedSecret, 'base64');
      var encryptedVerifyToken = pubKey.encrypt(packet.verifyToken, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
      var encryptedVerifyTokenBuffer = new Buffer(encryptedVerifyToken, 'base64');
      parser.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      parser.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      console.log("write enc key response");
      parser.writePacket(Parser.ENCRYPTION_KEY_RESPONSE, {
        sharedSecret: encryptedSharedSecretBuffer,
        verifyToken: encryptedVerifyTokenBuffer,
      });
    }
  });
}

function onEncryptionKeyResponse(packet) {
  console.log("confirmation enc key response");
  assert.strictEqual(packet.sharedSecret.length, 0);
  assert.strictEqual(packet.verifyToken.length, 0);
  parser.encryptionEnabled = true;
  parser.writePacket(Parser.CLIENT_STATUSES, { payload: 0 });
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

function mcHexDigest(hash) {
  var buffer = new Buffer(hash.digest(), 'binary');
  // check for negative hashes
  var negative = buffer.readInt8(0) < 0;
  if (negative) performTwosCompliment(buffer);
  var digest = buffer.toString('hex');
  // trim leading zeroes
  digest = digest.replace(/^0+/g, '');
  if (negative) digest = '-' + digest;
  return digest;

  function performTwosCompliment(buffer) {
    var carry = true;
    var i, newByte, value;
    for (i = buffer.length - 1; i >= 0; --i) {
      value = buffer.readUInt8(i);
      newByte = ~value & 0xff;
      if (carry) {
        carry = newByte === 0xff;
        buffer.writeUInt8(newByte + 1, i);
      } else {
        buffer.writeUInt8(newByte, i);
      }
    }
  }
}

