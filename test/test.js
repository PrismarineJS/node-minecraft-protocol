var mc = require('../');
var states = mc.states;
var Client = mc.Client;
var Server = mc.Server;
var path = require('path');
var fs = require('fs');
var net = require('net');
var assert = require('power-assert');
var SURVIVE_TIME = 10000;
var getFieldInfo = require('../dist/utils').getFieldInfo;
var getField = require('../dist/utils').getField;
var MC_SERVER_PATH = path.join(__dirname, 'server');

var Wrap = require('minecraft-wrap').Wrap;

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

var download = require('minecraft-wrap').download;

mc.supportedVersions.forEach(function(supportedVersion){
  var mcData=require("minecraft-data")(supportedVersion);
  var version=mcData.version;
  var MC_SERVER_JAR_DIR = process.env.MC_SERVER_JAR_DIR;
  var MC_SERVER_JAR = MC_SERVER_JAR_DIR+"/minecraft_server."+version.minecraftVersion+".jar";
  var wrap=new Wrap(MC_SERVER_JAR,MC_SERVER_PATH);

  var packets = mcData.protocol.states;
  var packetIndexes = mc.readPackets(packets, states);
  var packetFields = packetIndexes.packetFields;


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
    for(state in packetFields) {
      if(!packetFields.hasOwnProperty(state)) continue;
      for(packetName in packetFields[state].toServer) {
        if(!packetFields[state].toServer.hasOwnProperty(packetName)) continue;
        packetInfo = packetFields[state]["toServer"][packetName];
        packetInfo=packetInfo ? packetInfo : null;
        it(state + ",ServerBound," + packetName,
          callTestPacket(packetName, packetInfo, state, true));
      }
      for(packetName in packetFields[state].toClient) {
        if(!packetFields[state].toClient.hasOwnProperty(packetName)) continue;
        packetInfo = packetFields[state]["toClient"][packetName];
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

  describe("client "+version.minecraftVersion, function() {
    this.timeout(10 * 60 * 1000);

    before(download.bind(null,version.minecraftVersion,MC_SERVER_JAR));

    afterEach(function(done) {
      wrap.stopServer(function(err){
        if(err)
          console.log(err);
        done(err);
      });
    });
    after(function(done) {
      wrap.deleteServerData(function(err){
        if(err)
          console.log(err);
        done(err);
      });
    });
    it("pings the server", function(done) {
      wrap.on('line',function(line){
        console.log(line);
      });
      wrap.startServer({
        motd: 'test1234',
        'max-players': 120,
      }, function(err) {
        if(err)
          return done(err);
        mc.ping({
          version: version.majorVersion
        }, function(err, results) {
          if(err) return done(err);
          assert.ok(results.latency >= 0);
          assert.ok(results.latency <= 1000);
          delete results.latency;
          delete results.favicon; // too lazy to figure it out
          /*        assert.deepEqual(results, {
           version: {
           name: '1.7.4',
           protocol: 4
           },
           description: { text: "test1234" }
           });*/
          done();
        });
      });
    });
    it.skip("connects successfully - online mode (STUBBED)", function(done) {
      wrap.startServer({'online-mode': 'true'}, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: process.env.MC_USERNAME,
          password: process.env.MC_PASSWORD,
          version: version.majorVersion
        });
        wrap.on('line', function(line) {
          var match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/);
          if(!match) return;
          assert.strictEqual(match[1], client.session.username);
          assert.strictEqual(match[2], "hello everyone; I have logged in.");
          wrap.writeServer("say hello\n");
        });
        var chatCount = 0;
        client.on('login', function(packet) {
          assert.strictEqual(packet.levelType, 'default');
          assert.strictEqual(packet.difficulty, 1);
          assert.strictEqual(packet.dimension, 0);
          assert.strictEqual(packet.gameMode, 0);
          client.write('chat', {
            message: "hello everyone; I have logged in."
          });
        });
        client.on('chat', function(packet) {
          done();
        });
      });
      done();
    });
    it.skip("connects successfully - offline mode (STUBBED)", function(done) {
      wrap.startServer({'online-mode': 'false'}, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.majorVersion
        });
        wrap.on('line', function(line) {
          var match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/);
          if(!match) return;
          assert.strictEqual(match[1], 'Player');
          assert.strictEqual(match[2], "hello everyone; I have logged in.");
          wrap.writeServer("say hello\n");
        });
        var chatCount = 0;
        client.on('login', function(packet) {
          assert.strictEqual(packet.levelType, 'default');
          assert.strictEqual(packet.difficulty, 1);
          assert.strictEqual(packet.dimension, 0);
          assert.strictEqual(packet.gameMode, 0);
          client.write('chat', {
            message: "hello everyone; I have logged in."
          });
        });
        client.on('chat', function(packet) {
          chatCount += 1;
          assert.ok(chatCount <= 2);
          var message = JSON.parse(packet.message);
          if(chatCount === 1) {
            assert.strictEqual(message.translate, "chat.type.text");
            assert.deepEqual(message["with"][0], {
              clickEvent: {
                action: "suggest_command",
                value: "/msg Player "
              },
              text: "Player"
            });
            assert.strictEqual(message["with"][1], "hello everyone; I have logged in.");
          } else if(chatCount === 2) {
            assert.strictEqual(message.translate, "chat.type.announcement");
            assert.strictEqual(message["with"][0], "Server");
            assert.deepEqual(message["with"][1], {
              text: "",
              extra: ["hello"]
            });
            done();
          }
        });
      });
      done();
    });
    it("gets kicked when no credentials supplied in online mode", function(done) {
      wrap.startServer({'online-mode': 'true'}, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.majorVersion
        });
        var gotKicked = false;
        client.on('disconnect', function(packet) {
          assert.ok(packet.reason.indexOf('"Failed to verify username!"')!=-1);
          gotKicked = true;
        });
        client.on('end', function() {
          assert.ok(gotKicked);
          done();
        });
      });
    });
    it("does not crash for " + SURVIVE_TIME + "ms", function(done) {
      wrap.startServer({'online-mode': 'false'}, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.majorVersion
        });
        client.on("login", function(packet) {
          client.write("chat", {
            message: "hello everyone; I have logged in."
          });
        });
        client.on("chat", function(packet) {
          var message = JSON.parse(packet.message);
          assert.strictEqual(message.translate, "chat.type.text");
          /*assert.deepEqual(message["with"][0], {
           clickEvent: {
           action: "suggest_command",
           value: "/msg Player "
           },
           text: "Player"
           });*/
          assert.strictEqual(message["with"][1], "hello everyone; I have logged in.");
          setTimeout(function() {
            done();
          }, SURVIVE_TIME);
        });
      });
    });
  });
  describe("mc-server "+version.minecraftVersion, function() {
    it("starts listening and shuts down cleanly", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        version: version.majorVersion
      });
      var listening = false;
      server.on('listening', function() {
        listening = true;
        server.close();
      });
      server.on('close', function() {
        assert.ok(listening);
        done();
      });
    });
    it("kicks clients that do not log in", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        kickTimeout: 100,
        checkTimeoutInterval: 10,
        version: version.majorVersion
      });
      var count = 2;
      server.on('connection', function(client) {
        client.on('end', function(reason) {
          assert.strictEqual(reason, '{"text":"LoginTimeout"}');
          server.close();
        });
      });
      server.on('close', function() {
        resolve();
      });
      server.on('listening', function() {
        var client = new mc.Client(false,version.majorVersion);
        client.on('end', function() {
          resolve();
        });
        client.connect(25565, '127.0.0.1');
      });

      function resolve() {
        count -= 1;
        if(count <= 0) done();
      }
    });
    it("kicks clients that do not send keepalive packets", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        kickTimeout: 100,
        checkTimeoutInterval: 10,
        version: version.majorVersion
      });
      var count = 2;
      server.on('connection', function(client) {
        client.on('end', function(reason) {
          assert.strictEqual(reason, '{"text":"KeepAliveTimeout"}');
          server.close();
        });
      });
      server.on('close', function() {
        resolve();
      });
      server.on('listening', function() {
        var client = mc.createClient({
          username: 'superpants',
          host: '127.0.0.1',
          port: 25565,
          keepAlive: false,
          version: version.majorVersion
        });
        client.on('end', function() {
          resolve();
        });
      });
      function resolve() {
        count -= 1;
        if(count <= 0) done();
      }
    });
    it("responds to ping requests", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        motd: 'test1234',
        'max-players': 120,
        version: version.majorVersion
      });
      server.on('listening', function() {
        mc.ping({
          host: '127.0.0.1',
          version: version.majorVersion
        }, function(err, results) {
          if(err) return done(err);
          assert.ok(results.latency >= 0);
          assert.ok(results.latency <= 1000);
          delete results.latency;
          assert.deepEqual(results, {
            version: {
              name: version.minecraftVersion,
              protocol: version.version
            },
            players: {
              max: 120,
              online: 0,
              sample: []
            },
            description: {text: "test1234"}
          });
          server.close();
        });
      });
      server.on('close', done);
    });
    it("clients can log in and chat", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        version: version.majorVersion
      });
      var username = ['player1', 'player2'];
      var index = 0;
      server.on('login', function(client) {
        assert.notEqual(client.id, null);
        assert.strictEqual(client.username, username[index++]);
        broadcast(client.username + ' joined the game.');
        client.on('end', function() {
          broadcast(client.username + ' left the game.', client);
          if(client.username === 'player2') server.close();
        });
        client.write('login', {
          entityId: client.id,
          levelType: 'default',
          gameMode: 1,
          dimension: 0,
          difficulty: 2,
          maxPlayers: server.maxPlayers,
          reducedDebugInfo: 0
        });
        client.on('chat', function(packet) {
          var message = '<' + client.username + '>' + ' ' + packet.message;
          broadcast(message);
        });
      });
      server.on('close', done);
      server.on('listening', function() {
        var player1 = mc.createClient({
          username: 'player1',
          host: '127.0.0.1',
          version: version.majorVersion
        });
        player1.on('login', function(packet) {
          assert.strictEqual(packet.gameMode, 1);
          assert.strictEqual(packet.levelType, 'default');
          assert.strictEqual(packet.dimension, 0);
          assert.strictEqual(packet.difficulty, 2);
          player1.once('chat', function(packet) {
            assert.strictEqual(packet.message, '{"text":"player2 joined the game."}');
            player1.once('chat', function(packet) {
              assert.strictEqual(packet.message, '{"text":"<player2> hi"}');
              player2.once('chat', fn);
              function fn(packet) {
                if(/<player2>/.test(packet.message)) {
                  player2.once('chat', fn);
                  return;
                }
                assert.strictEqual(packet.message, '{"text":"<player1> hello"}');
                player1.once('chat', function(packet) {
                  assert.strictEqual(packet.message, '{"text":"player2 left the game."}');
                  player1.end();
                });
                player2.end();
              }

              player1.write('chat', {message: "hello"});
            });
            player2.write('chat', {message: "hi"});
          });
          var player2 = mc.createClient({
            username: 'player2',
            host: '127.0.0.1',
            version: version.majorVersion
          });
        });
      });

      function broadcast(message, exclude) {
        var client;
        for(var clientId in server.clients) {
          if(!server.clients.hasOwnProperty(clientId)) continue;

          client = server.clients[clientId];
          if(client !== exclude) client.write('chat', {message: JSON.stringify({text: message}), position: 0});
        }
      }
    });
    it("kicks clients when invalid credentials", function(done) {
      this.timeout(10000);
      var server = mc.createServer({
        version: version.majorVersion
      });
      var count = 4;
      server.on('connection', function(client) {
        client.on('end', function(reason) {
          resolve();
          server.close();
        });
      });
      server.on('close', function() {
        resolve();
      });
      server.on('listening', function() {
        resolve();
        var client = mc.createClient({
          username: 'lalalal',
          host: "127.0.0.1",
          version: version.majorVersion
        });
        client.on('end', function() {
          resolve();
        });
      });
      function resolve() {
        count -= 1;
        if(count <= 0) done();
      }
    });
    it("gives correct reason for kicking clients when shutting down", function(done) {
      var server = mc.createServer({
        'online-mode': false,
        version: version.majorVersion
      });
      var count = 2;
      server.on('login', function(client) {
        client.on('end', function(reason) {
          assert.strictEqual(reason, '{"text":"ServerShutdown"}');
          resolve();
        });
        client.write('login', {
          entityId: client.id,
          levelType: 'default',
          gameMode: 1,
          dimension: 0,
          difficulty: 2,
          maxPlayers: server.maxPlayers,
          reducedDebugInfo: 0
        });
      });
      server.on('close', function() {
        resolve();
      });
      server.on('listening', function() {
        var client = mc.createClient({
          username: 'lalalal',
          host: '127.0.0.1',
          version: version.majorVersion
        });
        client.on('login', function() {
          server.close();
        });
      });
      function resolve() {
        count -= 1;
        if(count <= 0) done();
      }
    });
  });
})
