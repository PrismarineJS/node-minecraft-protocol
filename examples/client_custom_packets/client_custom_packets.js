var mc = require('minecraft-protocol');

if(process.argv.length < 4 || process.argv.length > 6) {
  console.log("Usage : node echo.js <host> <port> [<name>] [<password>]");
  process.exit(1);
}

var customPackets={
  "1.8": {
    "play": {
      "toClient": {
        "types": {
          "packet_custom_name": [
            "container",[
              {
                "name": "age",
                "type": "i64"
              },
              {
                "name": "time",
                "type": "i64"
              }
            ]
          ],
          "packet": [
            "container",
            [
              {
                "name": "name",
                "type": [
                  "mapper",
                  {
                    "type": "varint",
                    "mappings": {
                      "0x7A": "custom_name"
                    }
                  }
                ]
              },
              {
                "name": "params",
                "type": [
                  "switch",
                  {
                    "compareTo": "name",
                    "fields": {
                      "custom_name": "packet_custom_name"
                    }
                  }
                ]
              }
            ]
          ]
        }
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

client.on('custom_name',function(packet){
  console.log(packet);
});
