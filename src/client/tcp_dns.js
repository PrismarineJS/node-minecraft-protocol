const net = require('net');
const dns = require('dns');

module.exports = function(client, options) {
  options.port = options.port || 25565;
  options.host = options.host || 'localhost';

  options.connect = (client) => {
    if (options.stream) {
      client.setSocket(options.stream);
    } else if (options.port == 25565 && net.isIP(options.host) === 0) {
      dns.resolveSrv("_minecraft._tcp." + options.host, function(err, addresses) {
        if(addresses && addresses.length > 0) {
          client.setSocket(net.connect(addresses[0].port, addresses[0].name));
        } else {
          client.setSocket(net.connect(options.port, options.host));
        }
      });
    } else {
      client.setSocket(net.connect(options.port, options.host));
    }
  };
};
