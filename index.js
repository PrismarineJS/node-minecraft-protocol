var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , assert = require('assert')
  , ursa = require('ursa')
  , crypto = require('crypto')
  , bufferEqual = require('buffer-equal')
  , superagent = require('superagent')
  , protocol = require('./lib/protocol')
  , Client = require('./lib/client')
  , Server = require('./lib/server')

module.exports = {
  createClient: createClient,
  createServer: createServer,
  Client: Client,
  Server: Server,
  ping: require('./lib/ping'),
  protocol: protocol,
};

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
    options.port :
    options['server-port'] != null ?
      options['server-port'] :
      25565 ;
  var host = options.host || '0.0.0.0';
  var kickTimeout = options.kickTimeout || 10 * 1000;
  var checkTimeoutInterval = options.checkTimeoutInterval || 4 * 1000;
  var onlineMode = options['online-mode'] == null ? true : options['online-mode'];
  var encryptionEnabled = options.encryption == null ? true : options.encryption;

  var serverKey = ursa.generatePrivateKey(1024);

  var server = new Server(options);
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;
  server.onlineModeExceptions = {};
  server.on("connection", function(client) {
    client.once(0xfe, onPing);
    client.once(0x02, onHandshake);
    client.once(0xFC, onEncryptionKeyResponse);
    client.on('end', onEnd);

    var keepAlive = false;
    var loggedIn = false;
    var lastKeepAlive = null;

    var keepAliveTimer = null;
    var loginKickTimer = setTimeout(kickForNotLoggingIn, kickTimeout);

    var hash;

    function kickForNotLoggingIn() {
      client.end('LoginTimeout');
    }

    function keepAliveLoop() {
      if (! keepAlive) return;

      // check if the last keepAlive was too long ago (kickTimeout)
      var elapsed = new Date() - lastKeepAlive;
      if (elapsed > kickTimeout) {
        client.end('KeepAliveTimeout');
        return;
      }
      client.write(0x00, {
        keepAliveId: Math.floor(Math.random() * 2147483648)
      });
    }

    function onKeepAlive(packet) {
      lastKeepAlive = new Date();
    }

    function startKeepAlive() {
      keepAlive = true;
      lastKeepAlive = new Date();
      keepAliveTimer = setInterval(keepAliveLoop, checkTimeoutInterval);
      client.on(0x00, onKeepAlive);
    }

    function onEnd() {
      clearInterval(keepAliveTimer);
      clearTimeout(loginKickTimer);
    }

    function onPing(packet) {
      if (loggedIn) return;
      client.write(0xff, {
        reason: [
          '§1',
          protocol.version,
          protocol.minecraftVersion,
          server.motd,
          server.playerCount,
          server.maxPlayers,
        ].join('\u0000')
      });
    }

    function onHandshake(packet) {
      client.username = packet.username;
      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && ! isException) || (! onlineMode && isException);
      var serverId;
      if (needToVerify) {
        serverId = crypto.randomBytes(4).toString('hex');
      } else {
        serverId = '-';
      }
      if (encryptionEnabled) {
        client.verifyToken = crypto.randomBytes(4);
        var publicKeyStrArr = serverKey.toPublicPem("utf8").split("\n");
        var publicKeyStr = "";
        for (var i=1;i<publicKeyStrArr.length - 2;i++) {
          publicKeyStr += publicKeyStrArr[i]
        }
        client.publicKey = new Buffer(publicKeyStr,'base64');
        hash = crypto.createHash("sha1");
        hash.update(serverId);
        client.write(0xFD, {
          serverId: serverId,
          publicKey: client.publicKey,
          verifyToken: client.verifyToken
        });
      } else {
        loginClient();
      }
    }

    function onEncryptionKeyResponse(packet) {
      var verifyToken = serverKey.decrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      if (! bufferEqual(client.verifyToken, verifyToken)) {
        client.end('DidNotEncryptVerifyTokenProperly');
        return;
      }
      var sharedSecret = serverKey.decrypt(packet.sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      hash.update(sharedSecret);
      hash.update(client.publicKey);
      client.write(0xFC, {
        sharedSecret: new Buffer(0),
        verifyToken: new Buffer(0)
      });
      client.encryptionEnabled = true;

      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && ! isException) || (! onlineMode && isException);
      var nextStep = needToVerify ? verifyUsername : loginClient;
      nextStep();

      function verifyUsername() {
        var digest = mcHexDigest(hash);
        var request = superagent.get("http://session.minecraft.net/game/checkserver.jsp");
        request.query({
          user: client.username,
          serverId: digest
        });
        request.end(function(err, resp) {
          var myErr;
          if (err) {
            server.emit('error', err);
            client.end('McSessionUnavailable');
          } else if (resp.serverError) {
            myErr = new Error("session.minecraft.net is broken: " + resp.status);
            myErr.code = 'EMCSESSION500';
            server.emit('error', myErr);
            client.end('McSessionDown');
          } else if (resp.serverError) {
            myErr = new Error("session.minecraft.net rejected request: " + resp.status);
            myErr.code = 'EMCSESSION400';
            server.emit('error', myErr);
            client.end('McSessionRejectedAuthRequest');
          } else if (resp.text !== "YES") {
            client.end('FailedToVerifyUsername');
          } else {
            loginClient();
          }
        });
      }
    }

    function loginClient() {
      loggedIn = true;
      startKeepAlive();

      clearTimeout(loginKickTimer);
      loginKickTimer = null;

      server.playerCount += 1;
      client.once('end', function() {
        server.playerCount -= 1;
      });
      server.emit('login', client);
    }
  });
  server.listen(port, host);
  return server;
}

function createClient(options) {
  assert.ok(options, "options is required");
  var port = options.port || 25565;
  var host = options.host || 'localhost';
  assert.ok(options.username, "username is required");
  var haveCredentials = options.password != null;
  var keepAlive = options.keepAlive == null ? true : options.keepAlive;

  var client = new Client(false);
  client.on('connect', onConnect);
  if (keepAlive) client.on(0x00, onKeepAlive);
  client.once(0xFC, onEncryptionKeyResponse);
  client.once(0xFD, onEncryptionKeyRequest);

  if (haveCredentials) {
    // make a request to get the case-correct username before connecting.
    getLoginSession(options.username, options.password, function(err, session) {
      if (err) {
        client.emit('error', err);
      } else {
        client.session = session;
        client.username = session.username;
        client.emit('session');
        client.connect(port, host);
      }
    });
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username;
    client.connect(port, host);
  }

  return client;

  function onConnect() {
    client.write(0x02, {
      protocolVersion: protocol.version,
      username: client.username,
      serverHost: host,
      serverPort: port,
    });
  }

  function onKeepAlive(packet) {
    client.write(0x00, {
      keepAliveId: packet.keepAliveId
    });
  }

  function onEncryptionKeyRequest(packet) {
    crypto.randomBytes(16, gotSharedSecret);

    function gotSharedSecret(err, sharedSecret) {
      if (err) {
        client.emit('error', err);
        client.end();
        return
      }

      var hash = crypto.createHash('sha1');
      hash.update(packet.serverId);

      if (haveCredentials) {
        joinServerRequest(onJoinServerResponse);
      } else {
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
        var encryptedSharedSecretBuffer = pubKey.encrypt(sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = pubKey.encrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.write(0xfc, {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer,
        });
      }
    }
  }

  function onEncryptionKeyResponse(packet) {
    assert.strictEqual(packet.sharedSecret.length, 0);
    assert.strictEqual(packet.verifyToken.length, 0);
    client.encryptionEnabled = true;
    client.write(0xcd, { payload: 0 });
  }
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
