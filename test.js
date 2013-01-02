var mc = require('./');
var client = mc.createClient({
  username: process.env.MC_USERNAME,
  email: process.env.MC_EMAIL,
  password: process.env.MC_PASSWORD,
});
client.on('packet', function(packet) {
  if (packet.id !== 0x03) return;
  if (packet.message.indexOf(client.session.username) !== -1) return;
  client.writePacket(0x03, {
    message: packet.message,
  });
});
