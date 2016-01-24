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
proto.addType('fml|hsMapper',
  [
    "mapper",
    {
      "type": "byte",
      "mappings": {
        "0": "ServerHello",
        "1": "ClientHello",
        "2": "ModList",
        "3": "RegistryData",
        "-1": "HandshakeAck",
        "-2": "HandshakeReset"
      },
    }
  ]
);

// TODO: refactor to use one big switch like https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/src/transforms/serializer.js#L21
proto.addType('FML|HS',
  [
    "container",
    [
      {
        "name": "discriminator",
        "type": "fml|hsMapper"
      },

      {
        "anon": true,
        "type":
        [
          "switch",
          {
            "compareTo": "discriminator",
            "fields":
            {
              "ServerHello":
              [
                "container",
                [
                  {
                    "name": "fmlProtocolVersionServer",
                    "type": "byte"
                  },
                  {
                    "name": "overrideDimension",
                    "type":
                    [
                      "switch",
                      {
                        // "Only sent if protocol version is greater than 1."
                        "compareTo": "fmlProtocolVersionServer",
                        "fields":
                        {
                          "0": "void",
                          "1": "void"
                        },
                        "default": "int"
                      }
                    ]
                  },
                ],
              ],

              "ClientHello":
              [
                "container",
                [
                  {
                    "name": "fmlProtocolVersionClient",
                    "type": "byte"
                  }
                ]
              ],

              "ModList":
              [
                "container",
                [
                  {
                    "name": "mods",
                    "type":
                    [
                      "array",
                      {
                        "countType": "varint",
                        "type":
                        [
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
                    ]
                  }
                ],
              ],

              "RegistryData":
              [
                "container",
                [
                  {
                    "name": "hasMore",
                    "type": "boolean"
                  },

                  /* TODO: support all fields
                  {
                    "name": "registryName",
                    "type": "string"
                  },
                  */
                ],
              ],

              "HandshakeAck":
              [
                "container",
                [
                  {
                    "name": "phase",
                    "type": "byte"
                  },
                ],
              ],

            },
          }
        ]
      }
    ]
  ]
);

function writeAck(client, phase) {
  var ackData = proto.createPacketBuffer('FML|HS', {
    discriminator: 'HandshakeAck', // HandshakeAck,
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


    if (parsed.data.discriminator === 'ServerHello') {
      if (parsed.data.fmlProtocolVersionServer > 2) {
        // TODO: support higher protocols, if they change
      }

      client.write('custom_payload', {
        channel: 'REGISTER',
        data: new Buffer(['FML|HS', 'FML', 'FML|MP', 'FML', 'FORGE'].join('\0'))
      });

      var clientHello = proto.createPacketBuffer('FML|HS', {
        discriminator: 'ClientHello',
        fmlProtocolVersionClient: parsed.data.fmlProtocolVersionServer
      });

      client.write('custom_payload', {
        channel: 'FML|HS',
        data: clientHello
      });

      console.log('Sending client modlist');
      var modList = proto.createPacketBuffer('FML|HS', {
        discriminator: 'ModList',
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
    } else if (parsed.data.discriminator === 'ModList') {
      console.log('Server ModList:',parsed.data.mods);
      // TODO: client/server check if mods compatible

    } else if (parsed.data.discriminator === 'RegistryData') {
      console.log('RegistryData',parsed.data);
      if (!parsed.data.hasMore) {
        console.log('LAST RegistryData');

        writeAck(client, 3); // WAITINGSERVERCOMPLETE
      }
    } else if (parsed.data.discriminator === 'HandshakeAck') {
      if (parsed.data.phase === 2) { // WAITINGCACK
        writeAck(client, 4); // PENDINGCOMPLETE
      } else if (parsed.data.phase === 3) { // COMPLETE
        writeAck(client, 5); // COMPLETE
        console.log('HandshakeAck Complete!');
      }
    }
  }
});
