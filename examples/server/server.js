var mc = require('minecraft-protocol');

var options = {
  motd: 'Vox Industries',
  'max-players': 127,
  port: 25565,
  'online-mode': false
};

var server = mc.createServer(options);

server.on('login', function(client) {
  broadcast(client.username + ' joined the game.');
  var addr = client.socket.remoteAddress + ':' + client.socket.remotePort;
  console.log(client.username + ' connected', '(' + addr + ')');

  client.on('end', function() {
    broadcast(client.username + ' left the game.', client);
    console.log(client.username + ' disconnected', '(' + addr + ')');
  });

  // send init data so client will start rendering world
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 1,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers,
    reducedDebugInfo:false
  });
  client.write('position', {
    x: 0,
    y: 256,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });

  client.on('chat', function(data) {
    var message = '<' + client.username + '>' + ' ' + data.message;
    broadcast(message, null, client.username);
    console.log(message);
  });
});

server.on('error', function(error) {
  console.log('Error:', error);
});

server.on('listening', function() {
  console.log('Server listening on port', server.socketServer.address().port);
});

function broadcast(message, exclude, username) {
  var client, translate;
  translate = username ? 'chat.type.announcement' : 'chat.type.text';
  username = username || 'Server';
  for(var clientId in server.clients) {
    if(!server.clients.hasOwnProperty(clientId)) continue;

    client = server.clients[clientId];
    if(client !== exclude) {
      var msg = {
        translate: translate,
        "with": [
          username,
          message
        ]
      };
      client.write('chat', {
        message: JSON.stringify(msg),
        position:0
      });
    }
  }
}
