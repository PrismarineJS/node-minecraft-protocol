var mc = require('../../');

var states = mc.states;
function printHelpAndExit(exitCode) {
  console.log("usage: node proxy.js [<options>...] <target_srv> <user> [<password>]");
  console.log("options:");
  console.log("  --dump ID");
  console.log("    print to stdout messages with the specified ID.");
  console.log("  --dump-all");
  console.log("    print to stdout all messages, except those specified with -x.");
  console.log("  -x ID");
  console.log("    do not print messages with this ID.");
  console.log("  ID");
  console.log("    an integer in decimal or hex (given to JavaScript's parseInt())");
  console.log("    optionally prefixed with o for client->server or i for client<-server.");
  console.log("examples:");
  console.log("  node proxy.js --dump-all -x 0x0 -x 0x3 -x 0x12 -x 0x015 -x 0x16 -x 0x17 -x 0x18 -x 0x19 localhost Player");
  console.log("    print all messages except for some of the most prolific.");
  console.log("  node examples/proxy.js --dump i0x2d --dump i0x2e --dump i0x2f dump i0x30 --dump i0x31 --dump i0x32 --dump o0x0d --dump o0x0e --dump o0x0f --dump o0x10 --dump o0x11 localhost Player");
  console.log("    print messages relating to inventory management.");

  process.exit(exitCode);
}

if(process.argv.length < 4) {
  console.log("Too few arguments!");
  printHelpAndExit(1);
}

process.argv.forEach(function(val, index, array) {
  if(val == "-h") {
    printHelpAndExit(0);
  }
});

var args = process.argv.slice(2);
var host;
var port = 25565;
var user;
var passwd;

var printAllIds = false;
var printIdWhitelist = {};
var printIdBlacklist = {};
(function() {
  for(var i = 0; i < args.length; i++) {
    var option = args[i];
    if(!/^-/.test(option)) break;
    if(option == "--dump-all") {
      printAllIds = true;
      continue;
    }
    i++;
    var match = /^([io]?)(.*)/.exec(args[i]);
    var prefix = match[1];
    if(prefix === "") prefix = "io";
    var number = parseInt(match[2]);
    if(isNaN(number)) printHelpAndExit(1);
    if(option == "--dump") {
      printIdWhitelist[number] = prefix;
    } else if(option == "-x") {
      printIdBlacklist[number] = prefix;
    } else {
      printHelpAndExit(1);
    }
  }
  if(!(i + 2 <= args.length && args.length <= i + 3)) printHelpAndExit(1);
  host = args[i++];
  user = args[i++];
  passwd = args[i++];
})();

if(host.indexOf(':') != -1) {
  port = host.substring(host.indexOf(':') + 1);
  host = host.substring(0, host.indexOf(':'));
}

var srv = mc.createServer({
  'online-mode': false,
  port: 25566
});
srv.on('login', function(client) {
  var addr = client.socket.remoteAddress;
  console.log('Incoming connection', '(' + addr + ')');
  var endedClient = false;
  var endedTargetClient = false;
  client.on('end', function() {
    endedClient = true;
    console.log('Connection closed by client', '(' + addr + ')');
    if(!endedTargetClient)
      targetClient.end("End");
  });
  client.on('error', function() {
    endedClient = true;
    console.log('Connection error by client', '(' + addr + ')');
    if(!endedTargetClient)
      targetClient.end("Error");
  });
  var targetClient = mc.createClient({
    host: host,
    port: port,
    username: user,
    password: passwd,
    'online-mode': passwd != null ? true : false
  });
  var brokenPackets = [/*0x04, 0x2f, 0x30*/];
  client.on('packet', function(packet) {
    if(targetClient.state == states.PLAY && packet.state == states.PLAY) {
      if(shouldDump(packet.id, "o")) {
        console.log("client->server:",
          client.state + ".0x" + packet.id.toString(16) + " :",
          JSON.stringify(packet));
      }
      if(!endedTargetClient)
        targetClient.write(packet.id, packet);
    }
  });
  targetClient.on('packet', function(packet) {
    if(packet.state == states.PLAY && client.state == states.PLAY &&
      brokenPackets.indexOf(packet.id) === -1) {
      if(shouldDump(packet.id, "i")) {
        console.log("client<-server:",
          targetClient.state + ".0x" + packet.id.toString(16) + " :",
          (packet.id != 38 ? JSON.stringify(packet) : "Packet too big"));
      }
      if(!endedClient)
        client.write(packet.id, packet);
      if (packet.id === 0x46) // Set compression
        client.compressionThreshold = packet.threshold;
    }
  });
  var buffertools = require('buffertools');
  targetClient.on('raw', function(buffer, state) {
    if(client.state != states.PLAY || state != states.PLAY)
      return;
    var packetId = mc.types.varint[0](buffer, 0);
    var packetData = mc.parsePacketData(buffer, state, false, {"packet": 1}).results;
    var packetBuff = mc.createPacketBuffer(packetData.id, packetData.state, packetData, true);
    if(buffertools.compare(buffer, packetBuff) != 0) {
      console.log("client<-server: Error in packetId " + state + ".0x" + packetId.value.toString(16));
      console.log(buffer.toString('hex'));
      console.log(packetBuff.toString('hex'));
    }
    /*if (client.state == states.PLAY && brokenPackets.indexOf(packetId.value) !== -1)
     {
     console.log(`client<-server: raw packet);
     console.log(packetData);
     if (!endedClient)
     client.writeRaw(buffer);
     }*/
  });
  client.on('raw', function(buffer, state) {
    if(state != states.PLAY || targetClient.state != states.PLAY)
      return;
    var packetId = mc.types.varint[0](buffer, 0);
    var packetData = mc.parsePacketData(buffer, state, true, {"packet": 1}).results;
    var packetBuff = mc.createPacketBuffer(packetData.id, packetData.state, packetData, false);
    if(buffertools.compare(buffer, packetBuff) != 0) {
      console.log("client->server: Error in packetId " + state + ".0x" + packetId.value.toString(16));
      console.log(buffer.toString('hex'));
      console.log(packetBuff.toString('hex'));
    }
  });
  targetClient.on('end', function() {
    endedTargetClient = true;
    console.log('Connection closed by server', '(' + addr + ')');
    if(!endedClient)
      client.end("End");
  });
  targetClient.on('error', function() {
    endedTargetClient = true;
    console.log('Connection error by server', '(' + addr + ')');
    if(!endedClient)
      client.end("Error");
  });
});

function shouldDump(id, direction) {
  if(matches(printIdBlacklist[id])) return false;
  if(printAllIds) return true;
  if(matches(printIdWhitelist[id])) return true;
  return false;
  function matches(result) {
    return result != null && result.indexOf(direction) !== -1;
  }
}
