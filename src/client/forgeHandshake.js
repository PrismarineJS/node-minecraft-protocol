var ProtoDef = require('protodef').ProtoDef;
var assert = require('assert');
var debug = require('../debug');

var proto = new ProtoDef();
// copied from ../../dist/transforms/serializer.js TODO: refactor
proto.addType("string", ["pstring", {
      countType: "varint"
    }]);


// http://wiki.vg/Minecraft_Forge_Handshake
// TODO: move to https://github.com/PrismarineJS/minecraft-data
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
  debug('FML|HS',parsed);

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

      debug('Sending client modlist');
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
      debug('Server ModList:',parsed.data.mods);
      // Emit event so client can check client/server mod compatibility
      client.emit('forgeMods', parsed.data.mods);
      client.fmlHandshakeState = FMLHandshakeClientState.WAITINGSERVERCOMPLETE;
      break;
    }

    case FMLHandshakeClientState.WAITINGSERVERCOMPLETE:
    {
      assert.ok(parsed.data.discriminator === 'RegistryData', `expected RegistryData in WAITINGSERVERCOMPLETE, got ${parsed.data.discriminator}`);
      debug('RegistryData',parsed.data);
      // TODO: support <=1.7.10 single registry, https://github.com/ORelio/Minecraft-Console-Client/pull/100/files#diff-65b97c02a9736311374109e22d30ca9cR297
      if (parsed.data.hasMore === false) {
        debug('LAST RegistryData');

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
      debug('HandshakeAck Complete!');
      break;
    }

    default:
      console.error(`unexpected FML state ${fmlHandshakeState}`);
  }
}

module.exports = {
  fmlHandshakeStep
};
