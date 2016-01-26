var net = require('net');
var dns = require('dns');
var Client = require('./client');
var assert = require('assert');

var encrypt = require('./client/encrypt');
var keepalive = require('./client/keepalive');
var compress = require('./client/compress');
var caseCorrect = require('./client/caseCorrect');
var setProtocol = require('./client/setProtocol');
var play = require('./client/play');

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
  options.port = options.port || 25565;
  options.host = options.host || 'localhost';

  assert.ok(options.username, "username is required");

  var optVersion = options.version || require("./version").defaultVersion;
  var mcData=require("minecraft-data")(optVersion);
  var version = mcData.version;
  options.majorVersion = version.majorVersion;
  options.protocolVersion = version.version;

  var client = new Client(false, options.majorVersion);

  setProtocol(client, options);
  keepalive(client, options);
  encrypt(client);
  play(client);
  compress(client);
  caseCorrect(client, options);

  return client;
}
