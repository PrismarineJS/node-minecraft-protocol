var mc = require('../');

var options = {
  'online-mode': false,
};

var server = mc.createServer(options);

server.on('connection', function(client) {
  var addr = client.socket.remoteAddress;
  console.log('Incoming connection', '('+addr+')');

  client.on('end', function() {
    console.log('Connection closed', '('+addr+')');
  });

  // send init data so client will start rendering world
  client.write(0x0d, {
    x: 0,
    y: 1.62,
    stance: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    onGround: true
  });

  client.write(0x03, { message: 'Hello, world!' });
});

server.on('error', function(error) {
	console.log('Error:', error);
});

server.listen(function() {
	console.log('Server listening on port', server.port);
});
