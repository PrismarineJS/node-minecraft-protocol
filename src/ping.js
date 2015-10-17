var net = require('net');
var Client = require('./client');
var states = require("./states");

module.exports = ping;

function ping(options, cb) {
  var host = options.host || 'localhost';
  var port = options.port || 25565;
  var optVersion = options.version || require("./version").defaultVersion;
  var mcData=require("minecraft-data")(optVersion);
  var version = mcData.version;

  var client = new Client(false,version.majorVersion);
  client.on('error', function(err) {
    cb(err);
  });

  client.once('server_info', function(packet) {
    var data = JSON.parse(packet.response);
    var start = Date.now();
    client.once('ping', function(packet) {
      data.latency = Date.now() - start;
      cb(null, data);
      client.end();
    });
    client.write('ping', {time: [0, 0]});
  });

  client.on('state', function(newState) {
    if(newState === states.STATUS)
      client.write('ping_start', {});
  });

  client.on('connect', function() {
    client.write('set_protocol', {
      protocolVersion: version.version,
      serverHost: host,
      serverPort: port,
      nextState: 1
    });
    client.state = states.STATUS;
  });

  client.connect(port, host);
}
