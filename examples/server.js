var mc = require('../');

var yellow = '§e';
var players = [];

var options = {
  requireAuth: false,
  motd: 'Vox Industries',
  maxPlayers: 128,
};

var server = mc.createServer(options);

server.on('connection', function(client) {
		var player = {
			client: client,
			username: handshake.username,
			index: players.length
		};
		players.push(player);
		server.players = players.length;

		broadcast(yellow + player.username+' joined the game.');
		var addr = client.socket.remoteAddress + ':' + client.socket.remotePort;
		console.log(player.username+' connected', '('+addr+')');

		client.on('end', function() {
			players.splice(player.index, 1);
			server.players = players.length;

			broadcast(yellow + player.username+' left the game.', player);
			console.log(player.username+' disconnected', '('+addr+')');
		});

		// send init data so client will start rendering world
		client.write(0x01, {
			entityId: 0,
			levelType: 'default',
			gameMode: 1,
			dimension: 0,
			difficulty: 2,
			maxPlayers: 128
		});
		client.write(0x0d, {
			x: 0,
			y: 256,
			stance: 255,
			z: 0,
			yaw: 0,
			pitch: 0,
			onGround: 1
		});

		client.on(0x03, function(data) {
			var message = '<'+player.username+'>' + ' ' + data.message;
			broadcast(message);
			console.log(message);
		});
	}
);

server.on('error', function(error) {
	console.log('Error:', error);
});

server.listen(function() {
	console.log('Server listening on port', server.port);
});

function broadcast(message, exclude) {
	for(var i = 0; i < players.length; i++) {
		if(players[i].username !== exclude && i !== exclude && players[i] !== exclude) {
			players[i].client.write(0x03, { message: message });
		}
	}
}
