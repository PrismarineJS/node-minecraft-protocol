var mc = require('../');
var states = mc.states;
var Client = mc.Client;
var Server = mc.Server;
var net = require('net');
var assert = require('power-assert');
var getFieldInfo = require('protodef').utils.getFieldInfo;
var getField = require('protodef').utils.getField;

function evalCount(count, fields) {
  if(fields[count["field"]] in count["map"])
    return count["map"][fields[count["field"]]];
  return count["default"];
}

var values = {
  'i32': 123456,
  'i16': -123,
  'u16': 123,
  'varint': 25992,
  'i8': -10,
  'u8': 8,
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
    Object.keys(typeArgs).forEach(function(index){
      results[typeArgs[index].name] = getValue(typeArgs[index].type, results);
    });
    delete context[".."];
    return results;
  },
  'count': 1, // TODO : might want to set this to a correct value
  'bool': true,
  'f64': 99999.2222,
  'f32': -333.444,
  'slot': {
    blockId: 5,
    itemCount: 56,
    itemDamage: 2,
    nbtData: {
      type:"compound",
      name: "test", value: {
        test1: {type: "int", value: 4},
        test2: {type: "long", value: [12, 42]},
        test3: {type: "byteArray", value: [32]},
        test4: {type: "string", value: "ohi"},
        test5: {type: "list", value: {type: "int", value: [4]}},
        test6: {type: "compound", value: {test: {type: "int", value: 4}}},
        test7: {type: "intArray", value: [12, 42]}
      }
    }
  },
  'nbt':{
    type:"compound",
    name: "test", value: {
      test1: {type: "int", value: 4},
      test2: {type: "long", value: [12, 42]},
      test3: {type: "byteArray", value: [32]},
      test4: {type: "string", value: "ohi"},
      test5: {type: "list", value: {type: "int", value: [4]}},
      test6: {type: "compound", value: {test: {type: "int", value: 4}}},
      test7: {type: "intArray", value: [12, 42]}
    }
  },
  'optionalNbt':{
    type:"compound",
    name: "test", value: {
      test1: {type: "int", value: 4},
      test2: {type: "long", value: [12, 42]},
      test3: {type: "byteArray", value: [32]},
      test4: {type: "string", value: "ohi"},
      test5: {type: "list", value: {type: "int", value: [4]}},
      test6: {type: "compound", value: {test: {type: "int", value: 4}}},
      test7: {type: "intArray", value: [12, 42]}
    }
  },
  'compressedNbt':{
    type:"compound",
    name: "test", value: {
      test1: {type: "int", value: 4},
      test2: {type: "long", value: [12, 42]},
      test3: {type: "byteArray", value: [32]},
      test4: {type: "string", value: "ohi"},
      test5: {type: "list", value: {type: "int", value: [4]}},
      test6: {type: "compound", value: {test: {type: "int", value: 4}}},
      test7: {type: "intArray", value: [12, 42]}
    }
  },
  'i64': [0, 1],
  'entityMetadata': [
    {key: 17, value: 0, type: 0}
  ],
  'objectData': {
    intField: 9,
    velocityX: 1,
    velocityY: 2,
    velocityZ: 3
  },
  'UUID': "00112233-4455-6677-8899-aabbccddeeff",
  'position': {x: 12, y: 100, z: 4382821},
  'position_ibi': {x: 12, y: 100, z: 4382821},
  'position_isi': {x: 12, y: 100, z: 4382821},
  'position_iii': {x: 12, y: 100, z: 4382821},
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
  var PORT=Math.round(30000+Math.random()*20000);
  var mcData=require("minecraft-data")(supportedVersion);
  var version=mcData.version;
  var packets = mcData.protocol;

  describe("packets "+version.minecraftVersion, function() {
    var client, server, serverClient;
    before(function(done) {
      server = new Server(version.minecraftVersion);
      server.once('listening', function() {
        server.once('connection', function(c) {
          serverClient = c;
          done();
        });
        client = new Client(false,version.minecraftVersion);
        client.setSocket(net.connect(PORT, 'localhost'));
      });
      server.listen(PORT, 'localhost');
    });
    after(function(done) {
      client.on('end', function() {
        server.on('close', done);
        server.close();
      });
      client.end();
    });
    var packetInfo, field;
    Object.keys(packets).filter(function(state){return state!="types"}).forEach(function(state){
      Object.keys(packets[state]).forEach(function(direction){
        Object.keys(packets[state][direction].types).filter(function(packetName){return packetName!="packet"}).forEach(function(packetName){
          packetInfo = packets[state][direction].types[packetName][1];
          packetInfo=packetInfo ? packetInfo : null;
          it(state + ","+(direction=="toServer" ? "Server" : "Client")+"Bound," + packetName,
            callTestPacket(packetName.substr(7), packetInfo, state, direction=="toServer" ));
        });
      });
    });
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
      Object.keys(p1).forEach(function(field){
        if (p1[field] !== undefined)
          assert.ok(field in p2, "field " + field + " missing in p2, in p1 it has value " + JSON.stringify(p1[field]));
      });
      Object.keys(p2).forEach(function(field){
        assert.ok(field in p1, "field " + field + " missing in p1, in p2 it has value " + JSON.stringify(p2[field]));
      });
    }
  });

});
