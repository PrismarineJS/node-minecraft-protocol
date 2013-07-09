var mc = require('../');

var options = {
  'online-mode': false, // optional
};

var server = mc.createServer(options);

server.on('login', function(client) {
  var addr = client.socket.remoteAddress;
  console.log('Incoming connection', '('+addr+')');

  client.on('end', function() {
    console.log('Connection closed', '('+addr+')');
  });

  // send init data so client will start rendering world
  client.write(0x01, {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers
  });
  client.write(0x0d, {
    x: 0,
    y: 1.62,
    stance: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    onGround: true
  });

  var msg = {
    translate: 'chat.type.announcement',
    using: [
      'Server',
      'Hello, world!'
    ]
  };
  client.write(0x03, { message: JSON.stringify(msg) });
});

server.on('error', function(error) {
  console.log('Error:', error);
});

server.on('listening', function() {
  console.log('Server listening on port', server.socketServer.address().port);
});
