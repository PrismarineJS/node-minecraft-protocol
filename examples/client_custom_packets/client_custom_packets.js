var mc = require('minecraft-protocol');

if(process.argv.length < 4 || process.argv.length > 6) {
  console.log("Usage : node echo.js <host> <port> [<name>] [<password>]");
  process.exit(1);
}

var customPackets={
  "play":{
    "toClient":{
      "my_custom_packet": {
        "id": "0x7A",
        "fields": [
          {
            "name": "age",
            "type": "i64"
          },
          {
            "name": "time",
            "type": "i64"
          }
        ]
      }
    }
  }
};

var client = mc.createClient({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : "echo",
  password: process.argv[5],
  customPackets:customPackets
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

client.on('login',function(){
  client.deserializer.write(new Buffer("7A0000000000909327fffffffffffffc18","hex"));
  console.log('login');

});

client.on('my_custom_packet',function(packet){
  console.log(packet);
});
