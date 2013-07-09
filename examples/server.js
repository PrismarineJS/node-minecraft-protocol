var mc = require('../');

var yellow = '§e';

var options = {
  motd: 'Vox Industries',
  'max-players': 127,
  port: 25565,
  'online-mode': false,
};

var server = mc.createServer(options);

server.on('login', function(client) {
  broadcast(yellow + client.username+' joined the game.');
  var addr = client.socket.remoteAddress + ':' + client.socket.remotePort;
  console.log(client.username+' connected', '('+addr+')');

  client.on('end', function() {
    broadcast(yellow + client.username+' left the game.', client);
    console.log(client.username+' disconnected', '('+addr+')');
  });

  // send init data so client will start rendering world
  client.write(0x01, {
    entityId: client.id,
    levelType: 'default',
    gameMode: 1,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers
  });
  client.write(0x0d, {
    x: 0,
    y: 256,
    stance: 255,
    z: 0,
    yaw: 0,
    pitch: 0,
    onGround: true
  });

  client.on(0x03, function(data) {
    var message = '<'+client.username+'>' + ' ' + data.message;
    broadcast(message, client, client.username);
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
  var client, translate, username;
  translate = username ? 'chat.type.announcement' : 'chat.type.text';
  username = username || 'Server';
  for (var clientId in server.clients) {
    client = server.clients[clientId];
    if (client !== exclude) {
      var msg = {
        translate: translate,
        using: [
          username,
          'Hello, world!'
        ]
      };
      client.write(0x03, { message: JSON.stringify(msg) });
    }
  }
}
