var mc = require('../');

var states = mc.protocol.states;
function print_help() {
    console.log("usage: node proxy.js <target_srv> <user> [<password>]");
}

if (process.argv.length < 4) {
    console.log("Too few arguments!");
    print_help();
    process.exit(1);
}

process.argv.forEach(function(val, index, array) {
    if (val == "-h") {
        print_help();
        process.exit(0);
    }
});

var host = process.argv[2];
var port = 25565;
var user = process.argv[3];
var passwd = process.argv[4];

if (host.indexOf(':') != -1) {
    port = host.substring(host.indexOf(':')+1);
    host = host.substring(0, host.indexOf(':'));
}

var srv = mc.createServer({
  'online-mode': false,
  port: 25566
});
srv.on('login', function (client) {
  var addr = client.socket.remoteAddress;
  console.log('Incoming connection', '('+addr+')');
  var endedClient = false;
  var endedTargetClient = false;
  client.on('end', function() {
    endedClient = true;
    console.log('Connection closed by client', '('+addr+')');
    if (!endedTargetClient)
      targetClient.end("End");
  });
  client.on('error', function() {
    endedClient = true;
    console.log('Connection error by client', '('+addr+')');
    if (!endedTargetClient)
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
    if (targetClient.state == states.PLAY && packet.state == states.PLAY) {
      //console.log(`client->server: ${client.state}.${packet.id} : ${JSON.stringify(packet)}`);
      if (!endedTargetClient)
        targetClient.write(packet.id, packet);
    }
  });
  targetClient.on('packet', function(packet) {
    if (packet.state == states.PLAY && client.state == states.PLAY &&
        brokenPackets.indexOf(packet.id) === -1)
    {
      //console.log(`client<-server: ${targetClient.state}.${packet.id} : ${packet.id != 38 ? JSON.stringify(packet) : "Packet too big"}`);
      if (!endedClient)
        client.write(packet.id, packet);
    }
  });
  var buffertools = require('buffertools');
  targetClient.on('raw', function(buffer, state) {
    if (client.state != states.PLAY || state != states.PLAY)
      return;
    var packetId = mc.protocol.types.varint[0](buffer, 0);
    var packetData = mc.protocol.parsePacketData(buffer, state, false, {"packet": 1}).results;
    var packetBuff = mc.protocol.createPacketBuffer(packetData.id, packetData.state, packetData, true);
    if (buffertools.compare(buffer, packetBuff) != 0)
    {
      console.log("client<-server: Error in packetId " + state + ".0x" + packetId.value.toString(16));
      console.log(buffer.toString('hex'));
      console.log(packetBuff.toString('hex'));
    }
    /*if (client.state == states.PLAY && brokenPackets.indexOf(packetId.value) !== -1)
    {
      console.log(`client<-server: raw packet`);
      console.log(packetData);
      if (!endedClient)
        client.writeRaw(buffer);
    }*/
  });
  client.on('raw', function(buffer, state) {
    if (state != states.PLAY || targetClient.state != states.PLAY)
      return;
    var packetId = mc.protocol.types.varint[0](buffer, 0);
    var packetData = mc.protocol.parsePacketData(buffer, state, true, {"packet": 1}).results;
    var packetBuff = mc.protocol.createPacketBuffer(packetData.id, packetData.state, packetData, false);
    if (buffertools.compare(buffer, packetBuff) != 0)
    {
      console.log(`client->server: Error in packetId ${state}.0x${packetId.value.toString(16)}`);
      console.log(buffer.toString('hex'));
      console.log(packetBuff.toString('hex'));
    }
  });
  targetClient.on('end', function() {
    endedTargetClient = true;
    console.log('Connection closed by server', '('+addr+')');
    if (!endedClient)
      client.end("End");
  });
  targetClient.on('error', function() {
    endedTargetClient = true;
    console.log('Connection error by server', '('+addr+')');
    if (!endedClient)
      client.end("Error");
  });
});
