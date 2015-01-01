var EventEmitter = require('events').EventEmitter
        , util = require('util')
        , assert = require('assert')
        , crypto = require('crypto')
        , bufferEqual = require('buffer-equal')
        , superagent = require('superagent')
        , protocol = require('./lib/protocol')
        , Client = require('./lib/client')
        , Server = require('./lib/server')
        , Yggdrasil = require('./lib/yggdrasil.js')
        , getSession = Yggdrasil.getSession
        , validateSession = Yggdrasil.validateSession
        , joinServer = Yggdrasil.joinServer
        , states = protocol.states
        , debug = protocol.debug
        ;
var ursa;
try {
  ursa = require("ursa");
} catch(e) {
  console.log("You are using a pure-javascript implementation of RSA.");
  console.log("Your performance might be subpar. Please consider installing URSA");
  ursa = require("./rsa-wrap");
}

module.exports = {
  createClient: createClient,
  createServer: createServer,
  Client: Client,
  Server: Server,
  ping: require('./lib/ping'),
  protocol: protocol,
  yggdrasil: Yggdrasil,
};

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
          options.port :
          options['server-port'] != null ?
          options['server-port'] :
          25565;
  var host = options.host || '0.0.0.0';
  var kickTimeout = options.kickTimeout || 10 * 1000;
  var checkTimeoutInterval = options.checkTimeoutInterval || 4 * 1000;
  var onlineMode = options['online-mode'] == null ? true : options['online-mode'];

  var serverKey = ursa.generatePrivateKey(1024);

  var server = new Server(options);
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;
  server.onlineModeExceptions = {};
  server.on("connection", function(client) {
    client.once([states.HANDSHAKING, 0x00], onHandshake);
    client.once([states.LOGIN, 0x00], onLogin);
    client.once([states.STATUS, 0x00], onPing);
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
      if (!keepAlive)
        return;

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
      var response = {
        "version": {
          "name": protocol.minecraftVersion,
          "protocol": protocol.version
        },
        "players": {
          "max": server.maxPlayers,
          "online": server.playerCount,
          "sample": []
        },
        "description": {"text": server.motd},
        "favicon": server.favicon
      };

      client.once([states.STATUS, 0x01], function(packet) {
        client.write(0x01, { time: packet.time });
        client.end();
      });
      client.write(0x00, {response: JSON.stringify(response)});
    }

    function onLogin(packet) {
      client.username = packet.username;
      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && !isException) || (! onlineMode && isException);
      if (needToVerify) {
        var serverId = crypto.randomBytes(4).toString('hex');
        client.verifyToken = crypto.randomBytes(4);
        var publicKeyStrArr = serverKey.toPublicPem("utf8").split("\n");
        var publicKeyStr = "";
        for (var i = 1; i < publicKeyStrArr.length - 2; i++) {
          publicKeyStr += publicKeyStrArr[i]
        }
        client.publicKey = new Buffer(publicKeyStr, 'base64');
        hash = crypto.createHash("sha1");
        hash.update(serverId);
        client.once([states.LOGIN, 0x01], onEncryptionKeyResponse);
        client.write(0x01, {
          serverId: serverId,
          publicKey: client.publicKey,
          verifyToken: client.verifyToken
        });
      } else {
        loginClient();
      }
    }

    function onHandshake(packet) {
      if (packet.nextState == 1) {
        client.state = states.STATUS;
      } else if (packet.nextState == 2) {
        client.state = states.LOGIN;
      }
    }

    function onEncryptionKeyResponse(packet) {
      var verifyToken = serverKey.decrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      if (!bufferEqual(client.verifyToken, verifyToken)) {
        client.end('DidNotEncryptVerifyTokenProperly');
        return;
      }
      var sharedSecret = serverKey.decrypt(packet.sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
      hash.update(sharedSecret);
      hash.update(client.publicKey);
      client.encryptionEnabled = true;

      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && !isException) || (!onlineMode && isException);
      var nextStep = needToVerify ? verifyUsername : loginClient;
      nextStep();

      function verifyUsername() {
        var digest = mcHexDigest(hash);
        validateSession(client.username, digest, function(err, uuid) {
          if (err) {
            client.end("Failed to verify username!");
            return;
          }
          client.uuid = uuid;
          // Convert to a valid UUID until the session server updates and does
          // it automatically
          client.uuid = client.uuid.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, "$1-$2-$3-$4-$5");
          loginClient();
        });
      }
    }

    function loginClient() {
      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      if (onlineMode == false || isException) {
        client.uuid = "0-0-0-0-0";
      }
      //client.write('compress', { threshold: 256 }); // Default threshold is 256
      //client.compressionThreshold = 256;
      client.write(0x02, {uuid: client.uuid, username: client.username});
      client.state = states.PLAY;
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
  var clientToken = options.clientToken || Yggdrasil.generateUUID();
  var accessToken = options.accessToken || null;

  assert.ok(options.username, "username is required");
  var haveCredentials = options.password != null || (clientToken != null && accessToken != null);
  var keepAlive = options.keepAlive == null ? true : options.keepAlive;


  var client = new Client(false);
  client.on('connect', onConnect);
  if (keepAlive) client.on([states.PLAY, 0x00], onKeepAlive);
  client.once([states.LOGIN, 0x01], onEncryptionKeyRequest);
  client.once([states.LOGIN, 0x02], onLogin);
  client.once("compress", onCompressionRequest);
  client.once("set_compression", onCompressionRequest);
  if (haveCredentials) {
    // make a request to get the case-correct username before connecting.
    var cb = function(err, session) {
      if (err) {
        client.emit('error', err);
      } else {
        client.session = session;
        client.username = session.username;
        accessToken = session.accessToken;
        client.emit('session');
        client.connect(port, host);
      }
    };

    if (accessToken != null) getSession(options.username, accessToken, options.clientToken, true, cb);
    else getSession(options.username, options.password, options.clientToken, false, cb);
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username;
    client.connect(port, host);
  }

  return client;

  function onConnect() {
    client.write(0x00, {
      protocolVersion: protocol.version,
      serverHost: host,
      serverPort: port,
      nextState: 2
    });

    client.state = states.LOGIN;
    client.write(0x00, {
      username: client.username
    });
  }

  function onCompressionRequest(packet) {
    client.compressionThreshold = packet.threshold;
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

      if (haveCredentials) {
        joinServerRequest(onJoinServerResponse);
      } else {
        if (packet.serverId != '-') {
          debug('This server appears to be an online server and you are providing no password, the authentication will probably fail');
        }
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
        var hash = crypto.createHash('sha1');
        hash.update(packet.serverId);
        hash.update(sharedSecret);
        hash.update(packet.publicKey);

        var digest = mcHexDigest(hash);
        joinServer(this.username, digest, accessToken, client.session.selectedProfile.id, cb);
      }

      function sendEncryptionKeyResponse() {
        var pubKey = mcPubKeyToURsa(packet.publicKey);
        var encryptedSharedSecretBuffer = pubKey.encrypt(sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = pubKey.encrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.write(0x01, {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer,
        });
        client.encryptionEnabled = true;
      }
    }
  }
  
  function onLogin(packet) {
    client.state = states.PLAY;
    client.uuid = packet.uuid;
    client.username = packet.username;
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
  if (negative)
    performTwosCompliment(buffer);
  var digest = buffer.toString('hex');
  // trim leading zeroes
  digest = digest.replace(/^0+/g, '');
  if (negative)
    digest = '-' + digest;
  return digest;

  function performTwosCompliment(buffer) {
    var carry = true;
    var i, newByte, value;
    for (i = buffer.length - 1; i >= 0; --i) {
      value = buffer.readUInt8(i);
      newByte = ~value & 0xff;
      if (carry) {
        carry = newByte === 0xff;
        buffer.writeUInt8((newByte + 1) & 0xff, i);
      } else {
        buffer.writeUInt8(newByte, i);
      }
    }
  }
}
