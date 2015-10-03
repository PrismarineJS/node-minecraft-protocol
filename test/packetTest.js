var mc = require('../');
var states = mc.states;
var Client = mc.Client;
var Server = mc.Server;
var net = require('net');
var assert = require('power-assert');
var getFieldInfo = require('../dist/utils').getFieldInfo;
var getField = require('../dist/utils').getField;

function evalCount(count, fields) {
  if(fields[count["field"]] in count["map"])
    return count["map"][fields[count["field"]]];
  return count["default"];
}

var values = {
  'int': 123456,
  'short': -123,
  'ushort': 123,
  'varint': 25992,
  'byte': -10,
  'ubyte': 8,
  'string': "hi hi this is my client string",
  'buffer': new Buffer(8),
  'array': function(typeArgs, context) {
    var count;
    if (typeof typeArgs.count === "object")
      count = evalCount(typeArgs.count, context);
    else if (typeof typeArgs.count !== "undefined")
      count = getField(typeArgs.count, context);
    else if (typeof typeArgs.countType !== "undefined")
      count = 1;
    var arr = [];
    while (count > 0) {
      arr.push(getValue(typeArgs.type, context));
      count--;
    }
    return arr;
  },
  'container': function(typeArgs, context) {
    var results = {
      "..": context
    };
    for(var index in typeArgs) {
      results[typeArgs[index].name] = getValue(typeArgs[index].type, results);
    }
    delete context[".."];
    return results;
  },
  'count': 1, // TODO : might want to set this to a correct value
  'bool': true,
  'double': 99999.2222,
  'float': -333.444,
  'slot': {
    blockId: 5,
    itemCount: 56,
    itemDamage: 2,
    nbtData: {
      root: "test", value: {
        test1: {type: "int", value: 4},
        test2: {type: "long", value: [12, 42]},
        test3: {type: "byteArray", value: new Buffer(32)},
        test4: {type: "string", value: "ohi"},
        test5: {type: "list", value: {type: "int", value: [4]}},
        test6: {type: "compound", value: {test: {type: "int", value: 4}}},
        test7: {type: "intArray", value: [12, 42]}
      }
    }
  },
  'long': [0, 1],
  'entityMetadata': [
    {key: 17, value: 0, type: 0}
  ],
  'objectData': {
    intField: 9,
    velocityX: 1,
    velocityY: 2,
    velocityZ: 3,
  },
  'UUID': "00112233-4455-6677-8899-aabbccddeeff",
  'position': {x: 12, y: 332, z: 4382821},
  'restBuffer': new Buffer(0),
  'switch': function(typeArgs, context) {
    var i = typeArgs.fields[getField(typeArgs.compareTo, context)];
    if (typeof i === "undefined")
      return getValue(typeArgs.default, context);
    else
      return getValue(i, context);
  },
  'option': function(typeArgs, context) {
    return getValue(typeArgs, context);
  }
};

function getValue(_type, packet) {
  var fieldInfo = getFieldInfo(_type);
  if (typeof values[fieldInfo.type] === "function")
    return values[fieldInfo.type](fieldInfo.typeArgs, packet);
  else if (values[fieldInfo.type] !== "undefined")
    return values[fieldInfo.type];
  else if (fieldInfo.type !== "void")
    throw new Error("No value for type " + fieldInfo.type);
}


mc.supportedVersions.forEach(function(supportedVersion){
  var mcData=require("minecraft-data")(supportedVersion);
  var version=mcData.version;
  var packets = mcData.protocol.states;

  describe("packets "+version.minecraftVersion, function() {
    var client, server, serverClient;
    before(function(done) {
      server = new Server(version.majorVersion);
      server.once('listening', function() {
        server.once('connection', function(c) {
          serverClient = c;
          done();
        });
        client = new Client(false,version.majorVersion);
        client.setSocket(net.connect(25565, 'localhost'));
      });
      server.listen(25565, 'localhost');
    });
    after(function(done) {
      client.on('end', function() {
        server.on('close', done);
        server.close();
      });
      client.end();
    });
    var packetName, packetInfo, field;
    for(state in packets) {
      if(!packets.hasOwnProperty(state)) continue;
      for(packetName in packets[state].toServer) {
        if(!packets[state].toServer.hasOwnProperty(packetName)) continue;
        packetInfo = packets[state]["toServer"][packetName].fields;
        packetInfo=packetInfo ? packetInfo : null;
        it(state + ",ServerBound," + packetName,
          callTestPacket(packetName, packetInfo, state, true));
      }
      for(packetName in packets[state].toClient) {
        if(!packets[state].toClient.hasOwnProperty(packetName)) continue;
        packetInfo = packets[state]["toClient"][packetName].fields;
        packetInfo=packetInfo ? packetInfo : null;
        it(state + ",ClientBound," + packetName,
          callTestPacket(packetName, packetInfo, state, false));
      }
    }
    function callTestPacket(packetName, packetInfo, state, toServer) {
      return function(done) {
        client.state = state;
        serverClient.state = state;
        testPacket(packetName, packetInfo, state, toServer, done);
      };
    }

    function testPacket(packetName, packetInfo, state, toServer, done) {
      // empty object uses default values
      var packet = {};
      packetInfo.forEach(function(field) {
        packet[field.name] = getValue(field.type, packet);
      });
      if(toServer) {
        serverClient.once(packetName, function(receivedPacket) {
          try {
            assertPacketsMatch(packet, receivedPacket);
          } catch (e) {
            console.log(packet, receivedPacket);
            throw e;
          }
          done();
        });
        client.write(packetName, packet);
      } else {
        client.once(packetName, function(receivedPacket) {
          assertPacketsMatch(packet, receivedPacket);
          done();
        });
        serverClient.write(packetName, packet);
      }
    }

    function assertPacketsMatch(p1, p2) {
      packetInfo.forEach(function(field) {
        assert.deepEqual(p1[field], p2[field]);
      });
      var field;
      for(field in p1) {
        if (p1[field] !== undefined)
          assert.ok(field in p2, "field " + field + " missing in p2, in p1 it has value " + JSON.stringify(p1[field]));
      }
      for(field in p2) {
        assert.ok(field in p1, "field " + field + " missing in p1, in p2 it has value " + JSON.stringify(p2[field]));
      }
    }
  });

});
