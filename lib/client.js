var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , protocol = require('./protocol')
  , dns = require('dns')
  , createPacketBuffer = protocol.createPacketBuffer
  , parsePacket = protocol.parsePacket
  , debug = protocol.debug
;

module.exports = Client;

function Client(isServer) {
  EventEmitter.call(this);

  this.isServer = !!isServer;
  this.socket = null;
  this.encryptionEnabled = false;
  this.cipher = null;
  this.decipher = null;
}
util.inherits(Client, EventEmitter);

Client.prototype.setSocket = function(socket) {
  var self = this;
  self.socket = socket;
  var incomingBuffer = new Buffer(0);
  self.socket.on('data', function(data) {
    if (self.encryptionEnabled) data = new Buffer(self.decipher.update(data), 'binary');
    incomingBuffer = Buffer.concat([incomingBuffer, data]);
    var parsed, packet;
    while (true) {
      parsed = parsePacket(incomingBuffer, self.isServer);
      if (! parsed) break;
      if (parsed.error) {
          this.emit('error', parsed.error);
          this.end("ProtocolError");
          return;
      }
      packet = parsed.results;
      incomingBuffer = incomingBuffer.slice(parsed.size);
      self.emit(packet.id, packet);
      self.emit('packet', packet);
    }
  });

  self.socket.on('connect', function() {
    self.emit('connect');
  });

  self.socket.on('error', onError);
  self.socket.on('close', endSocket);
  self.socket.on('end', endSocket);
  self.socket.on('timeout', endSocket);

  function onError(err) {
    self.emit('error', err);
    endSocket();
  }

  var ended = false;
  function endSocket() {
    if (ended) return;
    ended = true;
    self.socket.removeListener('close', endSocket);
    self.socket.removeListener('end', endSocket);
    self.socket.removeListener('timeout', endSocket);
    self.emit('end', self._endReason);
  }
};

Client.prototype.connect = function(port, host) {
  var self = this;
  if (port == 25565) {
      dns.resolveSrv("_minecraft._tcp." + host, function(err, addresses) {
      if (addresses) {
        self.setSocket(net.connect(addresses[0].port, addresses[0].name));
      } else {
        self.setSocket(net.connect(port, host));
      }
    });  
  } else {
    self.setSocket(net.connect(port, host));
  }
};

Client.prototype.end = function(reason) {
  this._endReason = reason;
  this.socket.end();
};

Client.prototype.write = function(packetId, params) {
  var buffer = createPacketBuffer(packetId, params, this.isServer);
  debug("writing packetId " + packetId + " (0x" + packetId.toString(16) + ")");
  debug(params);
  var out = this.encryptionEnabled ? new Buffer(this.cipher.update(buffer), 'binary') : buffer;
  this.socket.write(out);
};
