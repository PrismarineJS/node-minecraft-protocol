var mcHexDigest=require("./mcHexDigest");
var ursa=require("./ursa");
var version = require("./version");
var crypto = require('crypto');
var Yggdrasil = require('./yggdrasil.js');
var validateSession = Yggdrasil.validateSession;
var serializer = require("./transforms/serializer");
var states = serializer.states;
var bufferEqual = require('buffer-equal');
var Server = require('./server');

module.exports=createServer;

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
  // a function receiving the default status object and the client
  // and returning a modified response object.
  var beforePing = options.beforePing || null;

  var enableKeepAlive = options.keepAlive == null ? true : options.keepAlive;

  var serverKey = ursa.generatePrivateKey(1024);

  var server = new Server(options);
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;
  server.onlineModeExceptions = {};
  server.on("connection", function(client) {
    if (enableKeepAlive) require('./modules/keepalive')({}, client, server);
    require('./modules/ping')({}, client, server);

    client.once([states.HANDSHAKING, 0x00], onHandshake);
    client.once([states.LOGIN, 0x00], onLogin);
    client.on('end', onEnd);

    var loggedIn = false;

    var loginKickTimer = setTimeout(kickForNotLoggingIn, kickTimeout);

    var hash;

    function kickForNotLoggingIn() {
      client.end('LoginTimeout');
    }

    function onEnd() {
      clearTimeout(loginKickTimer);
    }

    function onLogin(packet) {
      client.username = packet.username;
      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && !isException) || (!onlineMode && isException);
      if(needToVerify) {
        var serverId = crypto.randomBytes(4).toString('hex');
        client.verifyToken = crypto.randomBytes(4);
        var publicKeyStrArr = serverKey.toPublicPem("utf8").split("\n");
        var publicKeyStr = "";
        for(var i = 1; i < publicKeyStrArr.length - 2; i++) {
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
      client.serverHost = packet.serverHost;
      client.serverPort = packet.serverPort;
      client.protocolVersion = packet.protocolVersion;
      if(packet.nextState == 2) {
        client.state = states.LOGIN;
      }
    }

    function onEncryptionKeyResponse(packet) {
      try {
        var verifyToken = serverKey.decrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        if(!bufferEqual(client.verifyToken, verifyToken)) {
          client.end('DidNotEncryptVerifyTokenProperly');
          return;
        }
        var sharedSecret = serverKey.decrypt(packet.sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      } catch(e) {
        client.end('DidNotEncryptVerifyTokenProperly');
        return;
      }
      client.setEncryption(sharedSecret);
      hash.update(sharedSecret);
      hash.update(client.publicKey);

      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      var needToVerify = (onlineMode && !isException) || (!onlineMode && isException);
      var nextStep = needToVerify ? verifyUsername : loginClient;
      nextStep();

      function verifyUsername() {
        var digest = mcHexDigest(hash);
        validateSession(client.username, digest, function(err, uuid, profile) {
          if(err) {
            client.end("Failed to verify username!");
            return;
          }
          client.uuid = uuid;
          // Convert to a valid UUID until the session server updates and does
          // it automatically
          client.uuid = client.uuid.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, "$1-$2-$3-$4-$5");
          client.profile = profile;
          loginClient();
        });
      }
    }

    function loginClient() {
      var isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      if(onlineMode == false || isException) {
        client.uuid = "0-0-0-0-0";
      }
      //client.write('compress', { threshold: 256 }); // Default threshold is 256
      //client.compressionThreshold = 256;
      client.write(0x02, {uuid: client.uuid, username: client.username});
      client.state = states.PLAY;
      loggedIn = true;

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
