var mc = require('../');
var Server = mc.Server;
var path = require('path');
var assert = require('power-assert');
var SURVIVE_TIME = 10000;
var MC_SERVER_PATH = path.join(__dirname, 'server');

var Wrap = require('minecraft-wrap').Wrap;


var download = require('minecraft-wrap').download;


mc.supportedVersions.forEach(function(supportedVersion) {
  var PORT=Math.round(30000+Math.random()*20000);
  var mcData = require("minecraft-data")(supportedVersion);
  var version = mcData.version;
  var MC_SERVER_JAR_DIR = process.env.MC_SERVER_JAR_DIR;
  var MC_SERVER_JAR = MC_SERVER_JAR_DIR + "/minecraft_server." + version.minecraftVersion + ".jar";
  var wrap = new Wrap(MC_SERVER_JAR, MC_SERVER_PATH);

  describe("client " + version.minecraftVersion, function() {
    this.timeout(10 * 60 * 1000);

    before(download.bind(null, version.minecraftVersion, MC_SERVER_JAR));

    afterEach(function(done) {
      wrap.stopServer(function(err) {
        if(err)
          console.log(err);
        done(err);
      });
    });
    after(function(done) {
      wrap.deleteServerData(function(err) {
        if(err)
          console.log(err);
        done(err);
      });
    });
    it("pings the server", function(done) {
      wrap.on('line', function(line) {
        console.log(line);
      });
      wrap.startServer({
        motd: 'test1234',
        'max-players': 120,
        'server-port':PORT
      }, function(err) {
        if(err)
          return done(err);
        mc.ping({
          version: version.minecraftVersion,
          port:PORT
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
    it.skip("connects successfully - online mode", function(done) {
      wrap.startServer({
        'online-mode': 'true',
        'server-port':PORT
      }, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: process.env.MC_USERNAME,
          password: process.env.MC_PASSWORD,
          version: version.minecraftVersion,
          port:PORT
        });
        var lineListener = function(line) {
          var match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/);
          if(!match) return;
          assert.strictEqual(match[1], client.username);
          assert.strictEqual(match[2], "hello everyone; I have logged in.");
          wrap.writeServer("say hello\n");
        };
        wrap.on('line', lineListener);
        client.on('login', function(packet) {
          assert.strictEqual(packet.levelType, 'default');
          assert.strictEqual(packet.difficulty, 1);
          assert.strictEqual(packet.dimension, 0);
          assert.strictEqual(packet.gameMode, 0);
          client.write('chat', {
            message: "hello everyone; I have logged in."
          });
        });
        var chatCount = 0;
        client.on('chat', function(packet) {
          chatCount += 1;
          assert.ok(chatCount <= 2);
          if(chatCount == 2) {
            client.removeAllListeners('chat');
            wrap.removeListener('line', lineListener);
            done();
          }
        });
      });
    });
    it("connects successfully - offline mode", function(done) {
      wrap.startServer({
        'online-mode': 'false',
        'server-port':PORT
      }, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port:PORT
        });
        var lineListener = function(line) {
          var match = line.match(/\[Server thread\/INFO\]: <(.+?)> (.+)/);
          if(!match) return;
          assert.strictEqual(match[1], 'Player');
          assert.strictEqual(match[2], "hello everyone; I have logged in.");
          wrap.writeServer("say hello\n");
        };
        wrap.on('line', lineListener);
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
            assert.deepEqual(message["with"][0].clickEvent, {
              action: "suggest_command",
              value: "/msg Player "
            });
            assert.deepEqual(message["with"][0].text, "Player");
            assert.strictEqual(message["with"][1], "hello everyone; I have logged in.");
          } else if(chatCount === 2) {
            assert.strictEqual(message.translate, "chat.type.announcement");
            assert.strictEqual(message["with"][0].text ? message["with"][0].text : message["with"][0], "Server");
            assert.deepEqual(message["with"][1].extra[0].text ?
              message["with"][1].extra[0].text : message["with"][1].extra[0], "hello");
            wrap.removeListener('line', lineListener);
            done();
          }
        });
      });
    });
    it("gets kicked when no credentials supplied in online mode", function(done) {
      wrap.startServer({
        'online-mode': 'true',
        'server-port':PORT
      }, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port:PORT
        });
        var gotKicked = false;
        client.on('disconnect', function(packet) {
          assert.ok(packet.reason.indexOf('"Failed to verify username!"') != -1);
          gotKicked = true;
        });
        client.on('end', function() {
          assert.ok(gotKicked);
          done();
        });
      });
    });
    it("does not crash for " + SURVIVE_TIME + "ms", function(done) {
      wrap.startServer({
        'online-mode': 'false',
        'server-port':PORT
      }, function(err) {
        if(err)
          return done(err);
        var client = mc.createClient({
          username: 'Player',
          version: version.minecraftVersion,
          port:PORT
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
});
