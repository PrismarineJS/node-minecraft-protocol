var mc = require('../')
  , states = mc.protocol.states

var client = mc.createClient({
  username: process.env.MC_USERNAME,
  password: process.env.MC_PASSWORD,
});
client.on('connect', function() {
  console.info('connected');
});
client.on([states.PLAY, 0x02], function(packet) {
  var jsonMsg = JSON.parse(packet.message);
  if (jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
    var username = jsonMsg.with[0];
    var msg = jsonMsg.with[1];
    if (username === client.username) return;
    client.write(0x01, {message: msg});
  }
});