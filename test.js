var Parser = require('./lib/parser');

var parser = new Parser();
parser.on('connect', function() {
  console.info("connect");
  parser.writePacket(0x02, {
    protocolVersion: 51,
    userName: 'superjoe30',
    serverHost: 'localhost',
    serverPort: 25565,
  });
});
parser.on('packet', function(packet) {
  var handler = packetHandlers[packet.id];
  if (handler) {
    handler(packet);
  } else {
    console.warn("No packet handler for", packet.id, "fields", packet);
  }
});
parser.on('error', function(err) {
  console.error("error connecting", err.stack);
});
parser.on('end', function() {
  console.info("disconnect");
});
parser.connect(25565, 'localhost');

var packetHandlers = {
  0xFD: onEncryptionKeyRequest,
};

function onEncryptionKeyRequest(packet) {
  var sharedSecret = randomBuffer(16);
}

function randomBuffer(size) {
  var buffer = new Buffer(size);
  var i, number;
  for (i = 0; i < size; ++i) {
    number = Math.floor(Math.random() * 256);
    buffer.writeUInt8(number, i);
  }
  return buffer;
}
