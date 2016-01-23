var mc = require('minecraft-protocol');
var ProtoDef = require('protodef').ProtoDef;

if(process.argv.length < 4 || process.argv.length > 6) {
  console.log("Usage : node echo.js <host> <port> [<name>] [<password>]");
  process.exit(1);
}

var client = mc.createClient({
  forge: true,
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : "echo",
  password: process.argv[5]
});

client.on('connect', function() {
  console.info('connected');
});
client.on('disconnect', function(packet) {
  console.log('disconnected: '+ packet.reason);
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

var proto = new ProtoDef();
// copied from ../../dist/transforms/serializer.js TODO: refactor
proto.addType("string", ["pstring", {
      countType: "varint"
    }]);


// http://wiki.vg/Minecraft_Forge_Handshake
// TODO: refactor to use one big switch like https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/src/transforms/serializer.js#L21
// and with a mapper for symbolic names https://github.com/PrismarineJS/prismarine-nbt/blob/master/nbt.json#L48
proto.addType('FML|HS',
  [
    'container',
    [
      {
        "name": "discriminator",
        "type": "byte"
      },

      // ServerHello
      {
        "name": "fmlProtocolVersionServer",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "0": "byte"
            },
            "default": "void"
          },
        ],
      },
      {
        "name": "overrideDimension",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "0": [
                "switch",
                {
                  // "Only sent if protocol version is greater than 1."
                  "compareTo": "fmlProtocolVersion",
                  "fields": {
                    "0": "void",
                    "1": "void"
                  },
                  "default": "int"
                }
              ]
            },
            "default": "void"
          },
        ],
      },

      // ClientHello
      {
        "name": "fmlProtocolVersionClient", // TODO: merge or fix name collision with fmlProtocolVersionServer?
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "1": "byte"
            },
            "default": "void"
          }
        ],
      },

      // ModList
      {
        "name": "mods",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "2": [
                "array",
                {
                  "countType": "varint",
                  "type": [
                    "container",
                    [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      }
                    ]
                  ],
                },
              ],
            },
            "default": "void"
          }
        // TODO: mods array: modname string, modversion string
        ],
      },

      // RegistryData
      {
        "name": "hasMore",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "3": "boolean"
            },
            "default": "void"
          },
        ],

        /* TODO: support all fields
        "name": "registryName",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "3": "string"
            },
            "default": "void"
          },
        ],
        */
      },

      // HandshakeAck
      {
        "name": "phase",
        "type": [
          "switch",
          {
            "compareTo": "discriminator",
            "fields": {
              "-1": "byte"
            },
            "default": "void"
          },
        ],
      },
    ]
  ]
);

function writeAck(client, phase) {
  var ackData = proto.createPacketBuffer('FML|HS', {
    discriminator: -1, // HandshakeAck,
    phase: 2 // WAITINGSERVERDATA
  });
  client.write('custom_payload', {
    channel: 'FML|HS',
    data: ackData
  });
}

client.on('custom_payload', function(packet) {
  var channel = packet.channel;
  var data = packet.data;

  if (channel === 'REGISTER') {
    var channels = data.toString().split('\0');
    console.log('Server-side registered channels:',channels);
    // TODO: do something?
    // expect:  [ 'FML|HS', 'FML', 'FML|MP', 'FML', 'FORGE' ]
  } else if (channel === 'FML|HS') {
    var parsed = proto.parsePacketBuffer('FML|HS', data);
    console.log('FML|HS',parsed);


    if (parsed.data.discriminator === 0) { // ServerHello
      if (parsed.data.fmlProtocolVersionServer > 2) {
        // TODO: support higher protocols, if they change
      }

      client.write('custom_payload', {
        channel: 'REGISTER',
        data: new Buffer(['FML|HS', 'FML', 'FML|MP', 'FML', 'FORGE'].join('\0'))
      });

      var clientHello = proto.createPacketBuffer('FML|HS', {
        discriminator: 1, // ClientHello
        fmlProtocolVersionClient: parsed.data.fmlProtocolVersionServer
      });

      client.write('custom_payload', {
        channel: 'FML|HS',
        data: clientHello
      });

      var modList = proto.createPacketBuffer('FML|HS', {
        discriminator: 2, // ModList
        //mods: []
        // TODO: send from ServerListPing packet, allow customizing not hardcoding
        mods: [
          {name:'IronChest', version:'6.0.121.768'}
        ]
      });
      client.write('custom_payload', {
        channel: 'FML|HS',
        data: modList
      });
      writeAck(client, 2); // WAITINGSERVERDATA
    } else if (parsed.data.discriminator === 2) { // ModList
      console.log('Server ModList:',parsed.data.mods);
      // TODO: client/server check if mods compatible

    } else if (parsed.data.discriminator === 3) { // RegistryData
      console.log('RegistryData',parsed.data);
      if (!parsed.data.hasMore) {
        console.log('LAST RegistryData');

        writeAck(client, 3); // WAITINGSERVERCOMPLETE
      }
    } else if (parsed.data.discriminator === -1) { // HandshakeAck
      if (parsed.data.phase === 2) { // WAITINGCACK
        writeAck(client, 4); // PENDINGCOMPLETE
      } else if (parsed.data.phase === 3) { // COMPLETE
        console.log('HandshakeAck Complete!');
      }
    }
  }
});
