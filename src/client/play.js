var states = require("../states");

module.exports = function(client) {
  client.once('success', onLogin);

  function onLogin(packet) {
    client.state = states.PLAY;
    client.uuid = packet.uuid;
    client.username = packet.username;
  }
};
