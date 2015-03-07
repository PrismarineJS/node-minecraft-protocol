var net = require('net')
  , Client = require('./client')
  , protocol = require('./protocol')
  , states = protocol.states
;

module.exports = ping;

function ping(options, cb) {
  var host = options.host || 'localhost';
  var port = options.port || 25565;

  var client = new Client();
  client.on('error', function(err) {
    cb(err);
  });
  
  client.once([states.STATUS, 0x00], function(packet) {
    var data = JSON.parse(packet.response);
    var start = Date.now();
    client.once(0x01, function(packet) {
      data.latency = Date.now() - start;
      cb(null, data);
      client.end();
    });
    client.write(0x01, { time: [0, 0]});
  });

  client.on('state', function(newState) {
    if (newState === states.STATUS)
      client.write(0x00, {});
  });
  
  client.on('connect', function() {
    client.write(0x00, {
      protocolVersion: 4,
      serverHost: host,
      serverPort: port,
      nextState: 1
    });
    client.state = states.STATUS;
  });
  
  client.connect(port, host);
}
