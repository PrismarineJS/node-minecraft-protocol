
var states = require("../states");

module.exports = function(client, options) {
  client.on('connect', onConnect);

  function onConnect() {
    client.write('set_protocol', {
      protocolVersion: options.protocolVersion,
      serverHost: options.host,
      serverPort: options.port,
      nextState: 2
    });
    client.state = states.LOGIN;
    client.write('login_start', {
      username: client.username
    });
  }


}
