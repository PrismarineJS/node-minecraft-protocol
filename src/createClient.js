var mcHexDigest=require("./mcHexDigest");
var ursa=require("./ursa");
var version = require("./version");
var net = require('net');
var dns = require('dns');
var Client = require('./client');
var assert = require('assert');
var crypto = require('crypto');
var Yggdrasil = require('./yggdrasil.js');
var getSession = Yggdrasil.getSession;
var joinServer = Yggdrasil.joinServer;
var serializer = require("./transforms/serializer");
var states = serializer.states;
var debug = require("./debug");

module.exports=createClient;


Client.prototype.connect = function(port, host) {
  var self = this;
  if(port == 25565 && net.isIP(host) === 0) {
    dns.resolveSrv("_minecraft._tcp." + host, function(err, addresses) {
      if(addresses && addresses.length > 0) {
        self.setSocket(net.connect(addresses[0].port, addresses[0].name));
      } else {
        self.setSocket(net.connect(port, host));
      }
    });
  } else {
    self.setSocket(net.connect(port, host));
  }
};

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
  if(keepAlive) client.on([states.PLAY, 0x00], onKeepAlive);
  client.once([states.LOGIN, 0x01], onEncryptionKeyRequest);
  client.once([states.LOGIN, 0x02], onLogin);
  client.once("compress", onCompressionRequest);
  client.on("set_compression", onCompressionRequest);
  if(haveCredentials) {
    // make a request to get the case-correct username before connecting.
    var cb = function(err, session) {
      if(err) {
        client.emit('error', err);
      } else {
        client.session = session;
        client.username = session.username;
        accessToken = session.accessToken;
        client.emit('session');
        client.connect(port, host);
      }
    };

    if(accessToken != null) getSession(options.username, accessToken, clientToken, true, cb);
    else getSession(options.username, options.password, clientToken, false, cb);
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username;
    client.connect(port, host);
  }

  return client;

  function onConnect() {
    client.write(0x00, {
      protocolVersion: version.version,
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
      if(err) {
        debug(err);
        client.emit('error', err);
        client.end();
        return;
      }
      if(haveCredentials) {
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
        var hash = crypto.createHash('sha1');
        hash.update(packet.serverId);
        hash.update(sharedSecret);
        hash.update(packet.publicKey);

        var digest = mcHexDigest(hash);
        joinServer(client.username, digest, accessToken, client.session.selectedProfile.id, cb);
      }

      function sendEncryptionKeyResponse() {
        var pubKey = mcPubKeyToURsa(packet.publicKey);
        var encryptedSharedSecretBuffer = pubKey.encrypt(sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = pubKey.encrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        client.write(0x01, {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer,
        });
        client.setEncryption(sharedSecret);
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
  while(base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + "\n";
    base64PubKey = base64PubKey.substring(maxLineLength);
  }
  pem += "-----END PUBLIC KEY-----\n";
  return ursa.createPublicKey(pem, 'utf8');
}
