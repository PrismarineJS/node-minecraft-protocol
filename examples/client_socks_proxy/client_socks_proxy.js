const mc = require('minecraft-protocol');
const Socks  = require("socks5-client");

if(process.argv.length < 6 || process.argv.length > 8) {
  console.log("Usage : node echo.js <host> <port> <proxyHost> <proxyPort> [<name>] [<password>]");
  process.exit(1);
}

const proxyHost=process.argv[4];
const proxyPort=process.argv[5];

const client = mc.createClient({
  stream: Socks.createConnection({
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    socksHost: proxyHost,
    socksPort: proxyPort
  }),
  username: process.argv[6] ? process.argv[6] : "echo",
  password: process.argv[7]
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
  const jsonMsg = JSON.parse(packet.message);
  if(jsonMsg.translate === 'chat.type.announcement' || jsonMsg.translate === 'chat.type.text') {
    const username = jsonMsg.with[0].text;
    const msg = jsonMsg.with[1];
    if(username === client.username) return;
    client.write('chat', {message: msg});
  }
});
