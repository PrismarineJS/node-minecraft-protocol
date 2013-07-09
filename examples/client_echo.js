var mc = require('../');
var client = mc.createClient({
  username: process.env.MC_USERNAME,
  password: process.env.MC_PASSWORD,
});
client.on('connect', function() {
  console.info('connected');
});
client.on(0x03, function(packet) {
  var jsonMsg = JSON.parse(packet.message);
  if (jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
    var username = jsonMsg.using[0];
    var msg = jsonMsg.using[1];
    if (username === client.username) return;
    client.write(0x03, {message: msg});
  }
});
