var net = require('net')
  , Client = require('./client')
  , states = require('./transforms/serializer').states
  ;

module.exports = ping;

function ping(options, cb) {
  var host = options.host || 'localhost';
  var port = options.port || 25565;

  var client = new Client();
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
      protocolVersion: 4,
      serverHost: host,
      serverPort: port,
      nextState: 1
    });
    client.state = states.STATUS;
  });

  client.connect(port, host);
}
