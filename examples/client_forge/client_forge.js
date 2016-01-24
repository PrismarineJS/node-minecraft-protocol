var mc = require('minecraft-protocol');

if(process.argv.length < 4 || process.argv.length > 6) {
  console.log("Usage : node echo.js <host> <port> [<name>] [<password>]");
  process.exit(1);
}

var host = process.argv[2];
var port = parseInt(process.argv[3]);
var username =  process.argv[4] ? process.argv[4] : "echo";
var password = process.argv[5];

mc.ping({host, port}, function(err, response) {
  if (err) throw err;
  console.log('ping response',response);
  if (!response.modinfo || response.modinfo.type !== 'FML') {
    throw new Error('not an FML server, aborting connection');
    // TODO: gracefully connect non-FML
    // TODO: could also use ping pre-connect to save description, type, negotiate protocol etc.
    //  ^ see https://github.com/PrismarineJS/node-minecraft-protocol/issues/327 
  }
  // Use the list of Forge mods from the server ping, so client will match server
  var forgeMods = response.modinfo.modList;
  console.log('Using forgeMods:',forgeMods);

  var client = mc.createClient({
    forge: true,
    forgeMods: forgeMods,
    // Client/server mods installed on the client
    // if not specified, pings server and uses its list
    /*
    forgeMods:
    */
    host: host,
    port: port,
    username: username,
    password: password
  });

  client.on('connect', function() {
    console.info('connected');
  });
  client.on('disconnect', function(packet) {
    console.log('disconnected: '+ packet.reason);
  });
  client.on('end', function(err) {
    console.log('Connection lost');
  });
  client.on('chat', function(packet) {
    var jsonMsg = JSON.parse(packet.message);
    if(jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
      var username = jsonMsg.with[0].text;
      var msg = jsonMsg.with[1];
      if(username === client.username) return;
      client.write('chat', {message: msg});
    }
  });
});
