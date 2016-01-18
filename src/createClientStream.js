var Client = require('./client');
var assert = require('assert');
var states = require("./states");
var EmptyTransformStream = require('through')();

module.exports=createClientStream;

function createClientStream(options) {
  assert.ok(options, "options is required");

  assert.ok(options.username, "username is required");
  var keepAlive = options.keepAlive == null ? true : options.keepAlive;
  var checkTimeoutInterval = options.checkTimeoutInterval || 10 * 1000;

  var optVersion = options.version || require("./version").defaultVersion;
  var mcData=require("minecraft-data")(optVersion);
  var version = mcData.version;

  var client = new Client(false,version.majorVersion);

  // Options to opt-out of MC protocol packet framing (useful since WS is alreay framed)
  // TODO: refactor
  if (options.noPacketFramer) {
    client.framer = EmptyTransformStream;
  }

  if(keepAlive) client.on('keep_alive', onKeepAlive);
  client.once('success', onLogin);
  client.once("compress", onCompressionRequest);
  client.on("set_compression", onCompressionRequest);

  client.username = options.username;

  var timeout = null;
  return client;

  function onCompressionRequest(packet) {
    client.compressionThreshold = packet.threshold;
  }
  function onKeepAlive(packet) {
    if (timeout)
      clearTimeout(timeout);
    timeout = setTimeout(() => client.end(), checkTimeoutInterval);
    client.write('keep_alive', {
      keepAliveId: packet.keepAliveId
    });
  }

  function onLogin(packet) {
    client.state = states.PLAY;
    client.uuid = packet.uuid;
    client.username = packet.username;
  }
}
