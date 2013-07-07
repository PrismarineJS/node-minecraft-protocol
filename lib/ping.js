var net = require('net')
  , Client = require('./client')

module.exports = ping;

function ping(options, cb) {
  var host = options.host || 'localhost';
  var port = options.port || 25565;

  var client = new Client();
  client.once(0xff, function(packet) {
    var parts = packet.reason.split('\u0000');
    var results;
    try {
      results = {
        prefix: parts[0],
        protocol: parseInt(parts[1], 10),
        version: parts[2],
        motd: parts[3],
        playerCount: parseInt(parts[4], 10),
        maxPlayers: parseInt(parts[5], 10),
        latency: Date.now() - start
      };
    } catch (err) {
      client.end();
      cb(err);
      return;
    }
    client.end();
    cb(null, results);
  });
  client.on('error', function(err) {
    cb(err);
  });
  client.on('connect', function() {
    client.write(0xfe, {
      unused1: 1,
      customPayloadId: 250,
      magicText: "MC|PingHost",
      len: 3 + ip.length + 4,
      magic: 73,
      ip: host,
      port: port,
    });
  });
  
  var start = Date.now();
  client.connect(port, host);
}
