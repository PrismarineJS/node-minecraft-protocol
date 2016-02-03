const states = require("../states");

module.exports = function(client, options) {
  client.on('connect', onConnect);

  function onConnect() {
    let taggedHost = options.host;
    if (options.tagHost) taggedHost += options.tagHost;

    if (client.wait_connect) {
      client.on('connect_allowed', next);
    } else {
      next();
    }

    function next() {
      client.write('set_protocol', {
        protocolVersion: options.protocolVersion,
        serverHost: taggedHost,
        serverPort: options.port,
        nextState: 2
      });
      client.state = states.LOGIN;
      client.write('login_start', {
        username: client.username
      });
    }
  }
};
