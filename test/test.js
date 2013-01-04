var mc = require('../')
  , spawn = require('child_process').spawn
  , path = require('path')
  , fs = require('fs')
  , assert = require('assert')
  , mkdirp = require('mkdirp')
  , rimraf = require('rimraf')
  , Batch = require('batch')
  , MC_SERVER_JAR = process.env.MC_SERVER_JAR
  , SURVIVE_TIME = 10000
  , MC_SERVER_PATH = path.join(__dirname, 'server')

var defaultServerProps = {
  'generator-settings': "",
  'allow-nether': 'true',
  'level-name': 'world',
  'enable-query': 'false',
  'allow-flight': 'false',
  'server-port': '25565',
  'level-type': 'DEFAULT',
  'enable-rcon': 'false',
  'level-seed': "",
  'server-ip': "",
  'max-build-height': '256',
  'spawn-npcs': 'true',
  'white-list': 'false',
  'spawn-animals': 'true',
  'snooper-enabled': 'true',
  'hardcore': 'false',
  'texture-pack': '',
  'online-mode': 'true',
  'pvp': 'true',
  'difficulty': '1',
  'gamemode': '0',
  'max-players': '20',
  'spawn-monsters': 'true',
  'generate-structures': 'true',
  'view-distance': '10',
  'spawn-protection': '16',
  'motd': 'A Minecraft Server',
};

describe("minecraft protocol", function() {
  this.timeout(20000);

  var mcServer;
  function startServer(propOverrides, done) {
    var props = {};
    var prop;
    for (prop in defaultServerProps) {
      props[prop] = defaultServerProps[prop];
    }
    for (prop in propOverrides) {
      props[prop] = propOverrides[prop];
    }
    var batch = new Batch();
    batch.push(function(cb) { mkdirp(MC_SERVER_PATH, cb); });
    batch.push(function(cb) {
      var str = "";
      for (var prop in props) {
        str += prop + "=" + props[prop] + "\n";
      }
      fs.writeFile(path.join(MC_SERVER_PATH, "server.properties"), str, cb);
    });
    batch.end(function(err) {
      if (err) return done(err);
      mcServer = spawn('java', [ '-jar', MC_SERVER_JAR, 'nogui'], {
        stdio: 'pipe',
        cwd: MC_SERVER_PATH,
      });
      mcServer.stdin.setEncoding('utf8');
      mcServer.stdout.setEncoding('utf8');
      mcServer.stderr.setEncoding('utf8');
      var buffer = "";
      mcServer.stdout.on('data', onData);
      mcServer.stderr.on('data', onData);
      function onData(data) {
        buffer += data;
        var lines = buffer.split("\n");
        var len = lines.length - 1;
        for (var i = 0; i < len; ++i) {
          mcServer.emit('line', lines[i]);
        }
        buffer = lines[lines.length - 1];
      }
      mcServer.on('line', onLine);
      mcServer.on('line', function(line) {
        process.stderr.write('.');
        // uncomment this line when debugging for more insight as to what is
        // happening on the minecraft server
        //console.error("[MC]", line);
      });
      function onLine(line) {
        if (/\[INFO\] Done/.test(line)) {
          mcServer.removeListener('line', onLine);
          done();
        }
      }
    });
  }
  afterEach(function(done) {
    mcServer.stdin.write("stop\n");
    mcServer.on('exit', function() {
      mcServer = null;
      done();
    });
  });
  after(function(done) {
    rimraf(MC_SERVER_PATH, done);
  });
  it("connects successfully - online mode", function(done) {
    startServer({ 'online-mode': 'true' }, function() {
      var client = mc.createClient({
        username: process.env.MC_USERNAME,
        email: process.env.MC_EMAIL,
        password: process.env.MC_PASSWORD,
      });
      mcServer.on('line', function(line) {
        var match = line.match(/\[INFO\] <(.+?)> (.+)$/);
        if (! match) return;
        assert.strictEqual(match[1], client.session.username);
        assert.strictEqual(match[2], "hello everyone; I have logged in.");
        mcServer.stdin.write("say hello\n");
      });
      var chatCount = 0;
      client.on(0x01, function(packet) {
        assert.strictEqual(packet.levelType, 'default');
        assert.strictEqual(packet.difficulty, 1);
        assert.strictEqual(packet.dimension, 0);
        assert.strictEqual(packet.gameMode, 0);
        client.writePacket(0x03, {
          message: "hello everyone; I have logged in."
        });
      });
      client.on(0x03, function(packet) {
        chatCount += 1;
        assert.ok(chatCount <= 2);
        if (chatCount === 1) {
          assert.strictEqual(packet.message, "<" + client.session.username + ">" + " hello everyone; I have logged in.");
        } else if (chatCount === 2) {
          assert.strictEqual(packet.message, "[Server] hello");
          done();
        }
      });
    });
  });
  it("connects successfully - offline mode", function(done) {
    startServer({ 'online-mode': 'false' }, function() {
      var client = mc.createClient({
        username: process.env.MC_USERNAME,
      });
      mcServer.on('line', function(line) {
        var match = line.match(/\[INFO\] <(.+?)> (.+)$/);
        if (! match) return;
        assert.strictEqual(match[1], process.env.MC_USERNAME);
        assert.strictEqual(match[2], "hello everyone; I have logged in.");
        mcServer.stdin.write("say hello\n");
      });
      var chatCount = 0;
      client.on(0x01, function(packet) {
          assert.strictEqual(packet.levelType, 'default');
          assert.strictEqual(packet.difficulty, 1);
          assert.strictEqual(packet.dimension, 0);
          assert.strictEqual(packet.gameMode, 0);
          client.writePacket(0x03, {
            message: "hello everyone; I have logged in."
          });
      });
      client.on(0x03, function(packet) {
        chatCount += 1;
        assert.ok(chatCount <= 2);
        if (chatCount === 1) {
          assert.strictEqual(packet.message, "<" + process.env.MC_USERNAME + ">" + " hello everyone; I have logged in.");
        } else if (chatCount === 2) {
          assert.strictEqual(packet.message, "[Server] hello");
          done();
        }
      });
    });
  });
  it("gets kicked when no credentials supplied in online mode", function(done) {
    startServer({ 'online-mode': 'true' }, function() {
      var client = mc.createClient({
        username: process.env.MC_USERNAME,
      });
      var gotKicked = false;
      client.on(0xff, function(packet) {
        assert.strictEqual(packet.reason, "Failed to verify username!");
        gotKicked = true;
      });
      client.on('end', function() {
        assert.ok(gotKicked);
        done();
      });
    });
  });
  it("does not crash for " + SURVIVE_TIME + "ms", function(done) {
    startServer({ 'online-mode': 'false' }, function() {
      var client = mc.createClient({
        username: process.env.MC_USERNAME,
      });
      client.on(0x01, function(packet) {
        client.writePacket(0x03, {
          message: "hello everyone; I have logged in."
        });
      });
      client.on(0x03, function(packet) {
        assert.strictEqual(packet.message, "<" + process.env.MC_USERNAME + ">" + " hello everyone; I have logged in.");
        setTimeout(function() {
          done();
        }, SURVIVE_TIME);
      });
    });
  });
});
