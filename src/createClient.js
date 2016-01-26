var ursa=require("./ursa");
var net = require('net');
var dns = require('dns');
var Client = require('./client');
var assert = require('assert');
var yggdrasil = require('yggdrasil')({});
var states = require("./states");
var debug = require("./debug");
var UUID = require('uuid-1345');
var encrypt = require('./client/encrypt');
var keepalive = require('./client/keepalive');
var compress = require('./client/compress');

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
  var clientToken = options.clientToken || UUID.v4().toString();
  var accessToken;

  assert.ok(options.username, "username is required");
  var haveCredentials = options.password != null || (clientToken != null && options.session != null);
  var keepAlive = options.keepAlive == null ? true : options.keepAlive;
  var checkTimeoutInterval = options.checkTimeoutInterval || 10 * 1000;

  var optVersion = options.version || require("./version").defaultVersion;
  var mcData=require("minecraft-data")(optVersion);
  var version = mcData.version;


  var client = new Client(false,version.majorVersion);
  client.on('connect', onConnect);
  if(keepAlive) keepalive(client);
  encrypt(client);
  client.once('success', onLogin);
  compress(client);
  if(haveCredentials) {
    // make a request to get the case-correct username before connecting.
    var cb = function(err, session) {
      if(err) {
        client.emit('error', err);
      } else {
        client.session = session;
        client.username = session.selectedProfile.name;
        accessToken = session.accessToken;
        client.emit('session');
        client.connect(port, host);
      }
    };

    if (options.session) {
      yggdrasil.validate(options.session.accessToken, function(ok) {
        if (ok)
          cb(null, options.session);
        else
          yggdrasil.refresh(options.session.accessToken, options.session.clientToken, function(err, _, data) {
            cb(err, data);
          });
      });
    }
    else yggdrasil.auth({
      user: options.username,
      pass: options.password,
      token: clientToken
    }, cb);
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username;
    client.connect(port, host);
  }

  return client;

  function onConnect() {
    client.write('set_protocol', {
      protocolVersion: version.version,
      serverHost: host,
      serverPort: port,
      nextState: 2
    });
    client.state = states.LOGIN;
    client.write('login_start', {
      username: client.username
    });
  }

  function onLogin(packet) {
    client.state = states.PLAY;
    client.uuid = packet.uuid;
    client.username = packet.username;
  }
}
