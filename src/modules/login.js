var states = require('../index').states;
var crypto = require('crypto');
var ursa = require('../ursa');
var mcHexDigest = require('../mcHexDigest');
var Yggdrasil = require('../yggdrasil');
var validateSession = Yggdrasil.validateSession;
var bufferEqual = require('buffer-equal');

module.exports = function(opts, client, server) {
  if (client.isServer)
    installServer(opts, client, server);
  else
    installClient(opts, client);
}

// Sets client.username, emits 'login' event on client when it is done.
function installServer(opts, client, server) {
  if (!server.serverKey)
    server.serverKey = ursa.generatePrivateKey(1024);

  // If client takes longer than 10 seconds to connect, kick him.
  var loginKickTimer = setTimeout(() => client.end('LoginTimeout'), 10 * 1000);
  client.on('end', () => clearTimeout(loginKickTimer));

  client.once("set_protocol", function(packet) {
    if (packet.nextState == 2)
      client.state = states.LOGIN;
  });

  client.once("login_start", function(packet) {
    client.username = packet.username;
    if (opts.onlineMode)
      loginOnlineMode(packet);
    else {
      // TODO : Generate a unique UUID for the client, probably derived
      // from his username.
      // The problem is, minecraft uses java's UUID#nameUUIDFromString,
      // which uses a broken implementation of UUIDv3. As such, we'll have to
      // recreate this function to match vanilla's behavior... lesigh.
      client.uuid = "00000000-0000-0000-0000-00000000000";
      loginClient();
    }
  });

  function loginOnlineMode(packet) {
    var serverId = crypto.randomBytes(4).toString('hex');
    var verifyToken = crypto.randomBytes(4);
    var pem = server.serverKey.toPublicPem('utf8').split("\n").slice(1, -2).join("");
    var publicKey = new Buffer(pem, "base64");
    var hash = crypto.createHash('sha1').update(serverId);
    client.write('encryption_begin', {
      serverId,
      publicKey,
      verifyToken,
    });
    client.once('encryption_begin', function(packet) {
      var sharedSecret;
      try {
        var newVerifyToken = server.serverKey.decrypt(packet.verifyToken, undefined, undefined, ursa.RSA_PKCS1_PADDING);
        if (!bufferEqual(newVerifyToken, verifyToken))
          return client.end('DidNotEncryptVerifyTokenProperly');
        sharedSecret = server.serverKey.decrypt(packet.sharedSecret, undefined, undefined, ursa.RSA_PKCS1_PADDING);
      } catch (e) {
        return client.end('DidNotEncryptVerifyTokenProperly');
      }
      client.setEncryption(sharedSecret);
      hash.update(sharedSecret);
      hash.update(publicKey);
      var digest = mcHexDigest(hash);
      validateSession(client.username, digest, (err, uuid, profile) => {
        if (err)
          return client.end("Failed to verify username!");
        client.uuid = uuid.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, "$1-$2-$3-$4-$5");
        client.profile = profile;
        loginClient();
      });
    });
  }

  function loginClient() {
    console.log(client.uuid, client.username);
    client.write("success", { uuid: client.uuid, username: client.username });
    client.state = states.PLAY;
    clearTimeout(loginKickTimer);
    loginKickTimer = null;
    server.emit('login', client);
  }
}
