const states = require("../states");

module.exports=function(client,server) {

  client.once('set_protocol', onHandshake);

  function onHandshake(packet) {
    client.serverHost = packet.serverHost;
    client.serverPort = packet.serverPort;
    client.protocolVersion = packet.protocolVersion;
    if (packet.nextState === 1) {
      client.state = states.STATUS;
    } else if (packet.nextState === 2) {
      client.state = states.LOGIN;
    }
    if (client.protocolVersion !== server.mcversion.version) {
      client.end("Wrong protocol version, expected: " + server.mcversion.version + " and you are using: " + client.protocolVersion);
    }
  }

};
