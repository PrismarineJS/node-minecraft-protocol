var states = require('./transforms/serializer').states;
var Server = require('./server');

module.exports = createServer;

function createServer({ host = '0.0.0.0',
                        port = 25565,
                        'online-mode' : onlineMode = true,
                        kickTimeout = 10 * 1000,
                        checkTimeoutInterval = 4 * 1000,
                        beforePing = null,
                        keepAlive = true,
                        motd = "A Minecraft server",
                        'max-players' : maxPlayers = 20,
                      } = {}) {
  var server = new Server();
  server.playerCount = 0;
  server.on("connection", function(client) {
    if (keepAlive) require('./modules/keepalive')({}, client, server);
    require('./modules/ping')({}, client, server);
    require('./modules/login')({ onlineMode, kickTimeout }, client, server);

    client.once([states.HANDSHAKING, 0x00], onHandshake);

    function onHandshake(packet) {
      client.serverHost = packet.serverHost;
      client.serverPort = packet.serverPort;
      client.protocolVersion = packet.protocolVersion;
    }
  });
  server.listen(port, host);
  return server;
}
