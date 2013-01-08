var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , protocol = require('./protocol')
  , createPacketBuffer = protocol.createPacketBuffer
  , parsePacket = protocol.parsePacket

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
      packet = parsed.results;
      incomingBuffer = incomingBuffer.slice(parsed.size);
      self.emit(packet.id, packet);
      self.emit('packet', packet);
    }
  });

  self.socket.on('error', function(err) {
    self.emit('error', err);
  });

  self.socket.on('close', function() {
    self.emit('end', self._endReason);
  });

  self.socket.on('connect', function() {
    self.emit('connect');
  });
};

Client.prototype.connect = function(port, host) {
  var self = this;
  self.setSocket(net.connect(port, host));
};

Client.prototype.end = function(reason) {
  this._endReason = reason;
  this.socket.end();
};

Client.prototype.write = function(packetId, params) {
  var buffer = createPacketBuffer(packetId, params, this.isServer);
  var out = this.encryptionEnabled ? new Buffer(this.cipher.update(buffer), 'binary') : buffer;
  this.socket.write(out);
};
