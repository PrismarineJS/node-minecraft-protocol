var version = require('../version');
var states = require('../index').states;

module.exports = function(opts, client, server) {
  if (!client.isServer)
    throw new Error("Client needs to be serverside");

  // First, inject the state-changing logic for the set_protocol packet
  client.once("set_protocol", function(packet) {
    if (packet.nextState == 1)
      client.state = states.STATUS;
  });

  // Then, the actual ping logic
  client.once("ping_start", function() {
    var response = {
      "version": {
        "name": version.minecraftVersion,
        "protocol": version.version
      },
      "players": {
        "max": server.maxPlayers,
        "online": server.playerCount,
        "sample": []
      },
      "description": {"text": server.motd},
      "favicon": server.favicon
    };

    if (opts.beforePing)
      response = opts.beforePing(response, client) || response;

    client.once("ping", function(packet) {
      client.write("ping", {time: packet.time});
      client.end();
    });
    client.write("server_info", {response: JSON.stringify(response)});
  });
}
