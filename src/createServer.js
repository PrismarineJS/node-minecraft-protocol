'use strict';

const Server = require('./server');
const NodeRSA = require('node-rsa');
const plugins = [
  require('./server/handshake'),
  require('./server/keepalive'),
  require('./server/login'),
  require('./server/ping')
];

module.exports=createServer;

function createServer(options={}) {
  const {
    host = '0.0.0.0',
    'server-port':serverPort,
    port = serverPort || 25565,
    motd = "A Minecraft server",
    'max-players' : maxPlayers = 20,
    version : optVersion = require("./version").defaultVersion,
    favicon,
    customPackets
  } = options;

  const mcData=require("minecraft-data")(optVersion);
  const version = mcData.version;


  const server = new Server(version.minecraftVersion,customPackets);
  server.mcversion=version;
  server.motd = motd;
  server.maxPlayers = maxPlayers;
  server.playerCount = 0;
  server.onlineModeExceptions = {};
  server.favicon = favicon;
  server.serverKey = new NodeRSA({b: 1024});
  
  server.on("connection", function(client) {
    plugins.forEach(plugin => plugin(client,server,options));
  });
  server.listen(port, host);
  return server;
}
