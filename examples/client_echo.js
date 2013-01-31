var mc = require('../');
var client = mc.createClient({
  username: process.env.MC_USERNAME,
  password: process.env.MC_PASSWORD,
});
client.on('connect', function() {
  console.info("connected");
});
client.on(0x03, function(packet) {
  var match = packet.message.match(/^<(.+?)> (.*)$/);
  if (! match) return;
  var username = match[1];
  var msg = match[2];
  if (username === client.username) return;
  client.write(0x03, {message: msg});
});
