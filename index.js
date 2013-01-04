var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , assert = require('assert')
  , ursa = require('ursa')
  , crypto = require('crypto')
  , superagent = require('superagent')
  , Batch = require('batch')
  , protocol = require('./lib/protocol')
  , createPacketBuffer = protocol.createPacketBuffer
  , parsePacket = protocol.parsePacket

exports.createClient = createClient;

function createClient(options) {
  // defaults
  assert.ok(options, "options is required");
  var port = options.port || 25565;
  var host = options.host || 'localhost';
  assert.ok(options.username, "username is required");
  var haveCredentials = options.email && options.password;

  var client = new Client();
  client.username = options.username;
  client.on('connect', function() {
    client.write(0x02, {
      protocolVersion: protocol.version,
      username: options.username,
      serverHost: host,
      serverPort: port,
    });
  });
  client.on(0x00, onKeepAlive);
  client.once(0xFC, onEncryptionKeyResponse);
  client.once(0xFD, onEncryptionKeyRequest);
  client.connect(port, host);

  return client;

  function onKeepAlive(packet) {
    client.write(0x00, {
      keepAliveId: packet.keepAliveId
    });
  }

  function onEncryptionKeyRequest(packet) {
    var batch = new Batch();
    var hash;
    if (haveCredentials) {
      hash = crypto.createHash('sha1');
      hash.update(packet.serverId);
      batch.push(function(cb) { getLoginSession(options.email, options.password, cb); });
    }
    batch.push(function(cb) { crypto.randomBytes(16, cb); });
    batch.end(function (err, results) {
      if (err) {
        client.emit('error', err);
        client.end();
        return
      }

      var sharedSecret;
      if (haveCredentials) {
        client.session = results[0];
        client.username = client.session.username;
        client.emit('session');
        sharedSecret = results[1];
        joinServerRequest(onJoinServerResponse);
      } else {
        sharedSecret = results[0];
        sendEncryptionKeyResponse();
      }

      function onJoinServerResponse(err) {
        if (err) {
          client.emit('error', err);
          client.end();
        } else {
          sendEncryptionKeyResponse();
        }
      }

      function joinServerRequest(cb) {
        hash.update(sharedSecret);
        hash.update(packet.publicKey);

        var digest = mcHexDigest(hash);
        var request = superagent.get("http://session.minecraft.net/game/joinserver.jsp");
        request.query({
          user: client.session.username,
          sessionId: client.session.id,
          serverId: digest,
        });
        request.end(function(err, resp) {
          var myErr;
          if (err) {
            cb(err);
          } else if (resp.serverError) {
            myErr = new Error("session.minecraft.net is broken: " + resp.status);
            myErr.code = 'EMCSESSION500';
            cb(myErr);
          } else if (resp.clientError) {
            myErr = new Error("session.minecraft.net rejected request: " + resp.status + " " + resp.text);
            myErr.code = 'EMCSESSION400';
            cb(myErr);
          } else {
            cb();
          }
        });
      }

      function sendEncryptionKeyResponse() {
        var pubKey = mcPubKeyToURsa(packet.publicKey);
        var encryptedSharedSecret = pubKey.encrypt(sharedSecret, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
        var encryptedSharedSecretBuffer = new Buffer(encryptedSharedSecret, 'base64');
        var encryptedVerifyToken = pubKey.encrypt(packet.verifyToken, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = new Buffer(encryptedVerifyToken, 'base64');
        client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.write(0xfc, {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer,
        });
      }
    });
  }

  function onEncryptionKeyResponse(packet) {
    assert.strictEqual(packet.sharedSecret.length, 0);
    assert.strictEqual(packet.verifyToken.length, 0);
    client.encryptionEnabled = true;
    client.write(0xcd, { payload: 0 });
  }
}

function Client(options) {
  EventEmitter.call(this);

  this.socket = null;
  this.encryptionEnabled = false;
  this.cipher = null;
  this.decipher = null;
}
util.inherits(Client, EventEmitter);

Client.prototype.connect = function(port, host) {
  var self = this;
  self.socket = net.connect(port, host, function() {
    self.emit('connect');
  });
  var incomingBuffer = new Buffer(0);
  self.socket.on('data', function(data) {
    if (self.encryptionEnabled) data = new Buffer(self.decipher.update(data), 'binary');
    incomingBuffer = Buffer.concat([incomingBuffer, data]);
    var parsed, packet;
    while (true) {
      parsed = parsePacket(incomingBuffer);
      if (! parsed) break;
      packet = parsed.results;
      incomingBuffer = incomingBuffer.slice(parsed.size);
      self.emit(packet.id, packet);
    }
  });

  self.socket.on('error', function(err) {
    self.emit('error', err);
  });

  self.socket.on('close', function() {
    self.emit('end');
  });
};

Client.prototype.end = function() {
  this.socket.end();
};

Client.prototype.write = function(packetId, params) {
  var buffer = createPacketBuffer(packetId, params);
  var out = this.encryptionEnabled ? new Buffer(this.cipher.update(buffer), 'binary') : buffer;
  this.socket.write(out);
};


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

function getLoginSession(email, password, cb) {
  var req = superagent.post("https://login.minecraft.net");
  req.type('form');
  req.send({
    user: email,
    password: password,
    version: protocol.sessionVersion,
  });
  req.end(function(err, resp) {
    var myErr;
    if (err) {
      cb(err);
    } else if (resp.serverError) {
      myErr = new Error("login.minecraft.net is broken: " + resp.status);
      myErr.code = 'ELOGIN500';
      cb(myErr);
    } else if (resp.clientError) {
      myErr = new Error("login.minecraft.net rejected request: " + resp.status + " " + resp.text);
      myErr.code = 'ELOGIN400';
      cb(myErr);
    } else {
      var values = resp.text.split(':');
      var session = {
        currentGameVersion: values[0],
        username: values[2],
        id: values[3],
        uid: values[4],
      };
      if (session.id && session.username) {
        cb(null, session);
      } else {
        myErr = new Error("login.minecraft.net rejected request: " + resp.status + " " + resp.text);
        myErr.code = 'ELOGIN400';
        cb(myErr);
      }
    }
  });
}
