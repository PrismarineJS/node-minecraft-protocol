var mc = require('minecraft-protocol');
var ProtoDef = require('protodef').ProtoDef;
var assert = require('assert');

if(process.argv.length < 4 || process.argv.length > 6) {
  console.log("Usage : node echo.js <host> <port> [<name>] [<password>]");
  process.exit(1);
}

var host = process.argv[2];
var port = parseInt(process.argv[3]);
var username =  process.argv[4] ? process.argv[4] : "echo";
var password = process.argv[5];

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
                    "name": "fmlProtocolVersion",
                    "type": "byte"
                  },
                  {
                    "name": "overrideDimension",
                    "type":
                    [
                      "switch",
                      {
                        // "Only sent if protocol version is greater than 1."
                        "compareTo": "fmlProtocolVersion",
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
                    "name": "fmlProtocolVersion",
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
                              "name": "modid",
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
                    "type": "bool"
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
    phase: phase
  });
  client.write('custom_payload', {
    channel: 'FML|HS',
    data: ackData
  });
}

var FMLHandshakeClientState = {
  START: 1,
  WAITINGSERVERDATA: 2,
  WAITINGSERVERCOMPLETE: 3,
  PENDINGCOMPLETE: 4,
  COMPLETE: 5,
};

function fmlHandshakeStep(client, data)
{
  var parsed = proto.parsePacketBuffer('FML|HS', data);
  console.log('FML|HS',parsed);

  var fmlHandshakeState = client.fmlHandshakeState || FMLHandshakeClientState.START;

  switch(fmlHandshakeState) {
    case FMLHandshakeClientState.START:
    {
      assert.ok(parsed.data.discriminator === 'ServerHello', `expected ServerHello in START state, got ${parsed.data.discriminator}`);
      if (parsed.data.fmlProtocolVersion > 2) {
        // TODO: support higher protocols, if they change
      }

      client.write('custom_payload', {
        channel: 'REGISTER',
        data: new Buffer(['FML|HS', 'FML', 'FML|MP', 'FML', 'FORGE'].join('\0'))
      });

      var clientHello = proto.createPacketBuffer('FML|HS', {
        discriminator: 'ClientHello',
        fmlProtocolVersion: parsed.data.fmlProtocolVersion
      });

      client.write('custom_payload', {
        channel: 'FML|HS',
        data: clientHello
      });

      console.log('Sending client modlist');
      var modList = proto.createPacketBuffer('FML|HS', {
        discriminator: 'ModList',
        mods: client.forgeMods || []
      });
      client.write('custom_payload', {
        channel: 'FML|HS',
        data: modList
      });
      writeAck(client, FMLHandshakeClientState.WAITINGSERVERDATA);
      client.fmlHandshakeState = FMLHandshakeClientState.WAITINGSERVERDATA;
      break;
    }

    case FMLHandshakeClientState.WAITINGSERVERDATA:
    {
      assert.ok(parsed.data.discriminator === 'ModList', `expected ModList in WAITINGSERVERDATA state, got ${parsed.data.discriminator}`);
      console.log('Server ModList:',parsed.data.mods);
      // TODO: client/server check if mods compatible
      client.fmlHandshakeState = FMLHandshakeClientState.WAITINGSERVERCOMPLETE;
      break;
    }

    case FMLHandshakeClientState.WAITINGSERVERCOMPLETE:
    {
      assert.ok(parsed.data.discriminator === 'RegistryData', `expected RegistryData in WAITINGSERVERCOMPLETE, got ${parsed.data.discriminator}`);
      console.log('RegistryData',parsed.data);
      // TODO: support <=1.7.10 single registry, https://github.com/ORelio/Minecraft-Console-Client/pull/100/files#diff-65b97c02a9736311374109e22d30ca9cR297
      if (parsed.data.hasMore === false) {
        console.log('LAST RegistryData');

        writeAck(client, FMLHandshakeClientState.WAITINGSERVERCOMPLETE);
        client.fmlHandshakeState = FMLHandshakeClientState.PENDINGCOMPLETE;
      }
      break;
    }

    case FMLHandshakeClientState.PENDINGCOMPLETE:
    {
      assert.ok(parsed.data.discriminator === 'HandshakeAck', `expected HandshakeAck in PENDINGCOMPLETE, got ${parsed.data.discrimnator}`);
      assert.ok(parsed.data.phase === 2, `expected HandshakeAck phase WAITINGACK, got ${parsed.data.phase}`);
      writeAck(client, FMLHandshakeClientState.PENDINGCOMPLETE4);
      client.fmlHandshakeState = FMLHandshakeClientState.COMPLETE
      break;
    }

    case FMLHandshakeClientState.COMPLETE:
    {
      assert.ok(parsed.data.phase === 3, `expected HandshakeAck phase COMPLETE, got ${parsed.data.phase}`);

      writeAck(client, FMLHandshakeClientState.COMPLETE);
      console.log('HandshakeAck Complete!');
      break;
    }

    default:
      console.error(`unexpected FML state ${fmlHandshakeState}`);
  }
}

//var forgeMods; // = [ {modid:'IronChest', version:'6.0.121.768'} ];

mc.ping({host, port}, function(err, response) {
  if (err) throw err;
  console.log('ping response',response);
  if (!response.modinfo || response.modinfo.type !== 'FML') {
    throw new Error('not an FML server, aborting connection');
    // TODO: gracefully connect non-FML
    // TODO: could also use ping pre-connect to save description, type, negotiate protocol etc.
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

  client.on('custom_payload', function(packet) {
    var channel = packet.channel;
    var data = packet.data;

    if (channel === 'REGISTER') {
      var channels = data.toString().split('\0');
      console.log('Server-side registered channels:',channels);
      // TODO: do something?
      // expect:  [ 'FML|HS', 'FML', 'FML|MP', 'FML', 'FORGE' ]
    } else if (channel === 'FML|HS') {
      fmlHandshakeStep(client, data);
    }
  });
});


