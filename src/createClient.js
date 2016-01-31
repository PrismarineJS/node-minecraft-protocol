var Client = require('./client');
var assert = require('assert');

var encrypt = require('./client/encrypt');
var keepalive = require('./client/keepalive');
var compress = require('./client/compress');
var caseCorrect = require('./client/caseCorrect');
var setProtocol = require('./client/setProtocol');
var play = require('./client/play');
var tcp_dns = require('./client/tcp_dns');
var autoVersion = require('./client/autoVersion');

module.exports=createClient;

function createClient(options) {
  assert.ok(options, "options is required");
  assert.ok(options.username, "username is required");

  // TODO: avoid setting default version if autoVersion is enabled
  var optVersion = options.version || require("./version").defaultVersion;
  var mcData=require("minecraft-data")(optVersion);
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`);
  var version = mcData.version;
  options.majorVersion = version.majorVersion;
  options.protocolVersion = version.version;

  var client = new Client(false, options.majorVersion);
  client.options = options;

  tcp_dns(client);
  caseCorrect(client);
  if (options.version === false) autoVersion(client);
  setProtocol(client);
  keepalive(client);
  encrypt(client);
  play(client);
  compress(client);

  return client;
}
