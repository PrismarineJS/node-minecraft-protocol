'use strict';

const ursa=require("./ursa");
const crypto = require('crypto');
const yggserver = require('yggdrasil').server({});
const states = require("./states");
const bufferEqual = require('buffer-equal');
const Server = require('./server');
const UUID = require('uuid-1345');
const endianToggle = require('endian-toggle');

module.exports=createServer;

function createServer(options) {
  options = options || {};
  const port = options.port != null ?
    options.port :
    options['server-port'] != null ?
      options['server-port'] :
      25565;
  const host = options.host || '0.0.0.0';
  const kickTimeout = options.kickTimeout || 30 * 1000;
  const checkTimeoutInterval = options.checkTimeoutInterval || 4 * 1000;
  const onlineMode = options['online-mode'] == null ? true : options['online-mode'];
  // a function receiving the default status object and the client
  // and returning a modified response object.
  const beforePing = options.beforePing || null;

  const enableKeepAlive = options.keepAlive == null ? true : options.keepAlive;

  const optVersion = options.version || require("./version").defaultVersion;
  const mcData=require("minecraft-data")(optVersion);
  const version = mcData.version;

  const serverKey = ursa.generatePrivateKey(1024);

  const server = new Server(version.minecraftVersion,options.customPackets);
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;
  server.onlineModeExceptions = {};
  server.favicon = options.favicon || undefined;
  server.on("connection", function(client) {
    client.once('set_protocol', onHandshake);
    client.once('login_start', onLogin);
    client.once('ping_start', onPing);
    client.once('legacy_server_list_ping', onLegacyPing);
    client.on('end', onEnd);

    let keepAlive = false;
    let loggedIn = false;
    let lastKeepAlive = null;

    let keepAliveTimer = null;
    let loginKickTimer = setTimeout(kickForNotLoggingIn, kickTimeout);

    let serverId;

    let sendKeepAliveTime;

    function kickForNotLoggingIn() {
      client.end('LoginTimeout');
    }

    function keepAliveLoop() {
      if(!keepAlive)
        return;

      // check if the last keepAlive was too long ago (kickTimeout)
      const elapsed = new Date() - lastKeepAlive;
      if(elapsed > kickTimeout) {
        client.end('KeepAliveTimeout');
        return;
      }
      sendKeepAliveTime = new Date();
      client.write('keep_alive', {
        keepAliveId: Math.floor(Math.random() * 2147483648)
      });
    }

    function onKeepAlive() {
      if(sendKeepAliveTime) client.latency = (new Date()) - sendKeepAliveTime;
      lastKeepAlive = new Date();
    }

    function startKeepAlive() {
      keepAlive = true;
      lastKeepAlive = new Date();
      keepAliveTimer = setInterval(keepAliveLoop, checkTimeoutInterval);
      client.on('keep_alive', onKeepAlive);
    }

    function onEnd() {
      clearInterval(keepAliveTimer);
      clearTimeout(loginKickTimer);
    }

    function onPing() {
      const response = {
        "version": {
          "name": version.minecraftVersion,
          "protocol": version.version
        },
        "players": {
          "max": server.maxPlayers,
          "online": server.playerCount,
          "sample": []
        },
        "description": {"text": server.motd},
        "favicon": server.favicon
      };

      function answerToPing(err, response) {
        if ( err ) return;
        client.write('server_info', {response: JSON.stringify(response)});
      }

      if(beforePing) {
        if ( beforePing.length > 2 ) {
          beforePing(response, client, answerToPing);
        } else {
          answerToPing(null, beforePing(response, client) || response);
        }
      } else {
        answerToPing(null, response);
      }

      client.once('ping', function(packet) {
        client.write('ping', {time: packet.time});
        client.end();
      });
    }

    function onLegacyPing(packet) {
      if (packet.payload === 1) {
        const pingVersion = 1;
        sendPingResponse('\xa7' + [pingVersion, version.version, version.minecraftVersion,
            server.motd, server.playerCount.toString(), server.maxPlayers.toString()].join('\0'));
      } else {
        // ping type 0
        sendPingResponse([server.motd, server.playerCount.toString(), server.maxPlayers.toString()].join('\xa7'));
      }

      function sendPingResponse(responseString) {
        function utf16be(s) {
          return endianToggle(new Buffer(s, 'utf16le'), 16);
        }

        const responseBuffer = utf16be(responseString);

        const length = responseString.length; // UCS2 characters, not bytes
        const lengthBuffer = new Buffer(2);
        lengthBuffer.writeUInt16BE(length);

        const raw = Buffer.concat([new Buffer('ff', 'hex'), lengthBuffer, responseBuffer]);

        //client.writeRaw(raw); // not raw enough, it includes length
        client.socket.write(raw);
      }

    }

    function onLogin(packet) {
      client.username = packet.username;
      const isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      const needToVerify = (onlineMode && !isException) || (!onlineMode && isException);
      if(needToVerify) {
        serverId = crypto.randomBytes(4).toString('hex');
        client.verifyToken = crypto.randomBytes(4);
        const publicKeyStrArr = serverKey.toPublicPem("utf8").split("\n");
        let publicKeyStr = "";
        for(let i = 1; i < publicKeyStrArr.length - 2; i++) {
          publicKeyStr += publicKeyStrArr[i]
        }
        client.publicKey = new Buffer(publicKeyStr, 'base64');
        client.once('encryption_begin', onEncryptionKeyResponse);
        client.write('encryption_begin', {
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
      if(packet.nextState == 1) {
        client.state = states.STATUS;
      } else if(packet.nextState == 2) {
        client.state = states.LOGIN;
      }
      if(client.protocolVersion!=version.version)
      {
        client.end("Wrong protocol version, expected: "+version.version+" and you are using: "+client.protocolVersion);
      }
    }

    function onEncryptionKeyResponse(packet) {
      let sharedSecret;
      try {
        const verifyToken = serverKey.decrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        if(!bufferEqual(client.verifyToken, verifyToken)) {
          client.end('DidNotEncryptVerifyTokenProperly');
          return;
        }
        sharedSecret = serverKey.decrypt(packet.sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      } catch(e) {
        client.end('DidNotEncryptVerifyTokenProperly');
        return;
      }
      client.setEncryption(sharedSecret);

      const isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      const needToVerify = (onlineMode && !isException) || (!onlineMode && isException);
      const nextStep = needToVerify ? verifyUsername : loginClient;
      nextStep();

      function verifyUsername() {
        yggserver.hasJoined(client.username, serverId, sharedSecret, client.publicKey, function(err, profile) {
          if(err) {
            client.end("Failed to verify username!");
            return;
          }
          // Convert to a valid UUID until the session server updates and does
          // it automatically
          client.uuid = profile.id.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, "$1-$2-$3-$4-$5");
          client.profile = profile;
          loginClient();
        });
      }
    }


    // https://github.com/openjdk-mirror/jdk7u-jdk/blob/f4d80957e89a19a29bb9f9807d2a28351ed7f7df/src/share/classes/java/util/UUID.java#L163
    function javaUUID(s)
    {
      const hash = crypto.createHash("md5");
      hash.update(s, 'utf8');
      const buffer = hash.digest();
      buffer[6] = (buffer[6] & 0x0f) | 0x30;
      buffer[8] = (buffer[8] & 0x3f) | 0x80;
      return buffer;
    }

    function nameToMcOfflineUUID(name)
    {
      return (new UUID(javaUUID("OfflinePlayer:"+name))).toString();
    }

    function loginClient() {
      const isException = !!server.onlineModeExceptions[client.username.toLowerCase()];
      if(onlineMode == false || isException) {
        client.uuid = nameToMcOfflineUUID(client.username);
      }
      if (version.version >= 27) { // 14w28a (27) added whole-protocol compression (http://wiki.vg/Protocol_History#14w28a), earlier versions per-packet compressed TODO: refactor into minecraft-data
        client.write('compress', { threshold: 256 }); // Default threshold is 256
        client.compressionThreshold = 256;
      }
      client.write('success', {uuid: client.uuid, username: client.username});
      client.state = states.PLAY;
      loggedIn = true;
      if(enableKeepAlive) startKeepAlive();

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
