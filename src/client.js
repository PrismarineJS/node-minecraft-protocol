var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , protocol = require('./protocol')
  , createPacketBuffer = protocol.createPacketBuffer
  , compressPacketBuffer = protocol.compressPacketBuffer
  , oldStylePacket = protocol.oldStylePacket
  , newStylePacket = protocol.newStylePacket
  , parsePacketData = protocol.parsePacketData
  , parseNewStylePacket = protocol.parseNewStylePacket
  , packetIds = protocol.packetIds
  , packetNames = protocol.packetNames
  , states = protocol.states
  , debug = require('./debug')
  , serializer = require('./transforms/serializer')
  , compression = require('./transforms/compression')
  , framing = require('./transforms/framing')
  , crypto = require('crypto')
  ;

module.exports = Client;

function Client(isServer) {
  EventEmitter.call(this);

  var socket;

  this.serializer = serializer.createSerializer({ isServer });
  this.compressor = null;
  this.framer = framing.createFramer();
  this.cipher = null;

  this.decipher = null;
  this.splitter = framing.createSplitter();
  this.decompressor = null;
  this.deserializer = serializer.createDeserializer({ isServer });

  this._state = states.HANDSHAKING;
  Object.defineProperty(this, "state", {
    get: function() {
      return this.serializer.protocolState;
    },
    set: function(newProperty) {
      var oldProperty = this.serializer.protocolState;
      this.serializer.protocolState = newProperty;
      this.deserializer.protocolState = newProperty;
      this.emit('state', newProperty, oldProperty);
    }
  });
  Object.defineProperty(this, "compressionThreshold", {
    get: () => this.compressor == null ? -2 : this.compressor.compressionThreshold,
    set: (threshold) => this.setCompressionThreshold(threshold)
  });

  this.isServer = !!isServer;

  this.packetsToParse = {};
  this.on('newListener', function(event, listener) {
    var direction = this.isServer ? 'toServer' : 'toClient';
    if(protocol.packetStates[direction].hasOwnProperty(event) || event === "packet") {
      if(typeof this.packetsToParse[event] === "undefined") this.packetsToParse[event] = 1;
      else this.packetsToParse[event] += 1;
    }
  });
  this.on('removeListener', function(event, listener) {
    var direction = this.isServer ? 'toServer' : 'toClient';
    if(protocol.packetStates[direction].hasOwnProperty(event) || event === "packet") {
      this.packetsToParse[event] -= 1;
    }
  });
}

util.inherits(Client, EventEmitter);

// Transform weird "packet" types into string representing their type. Should be mostly retro-compatible
Client.prototype.on = function(type, func) {
  var direction = this.isServer ? 'toServer' : 'toClient';
  if(Array.isArray(type)) {
    arguments[0] = protocol.packetNames[type[0]][direction][type[1]];
  } else if(typeof type === "number") {
    arguments[0] = protocol.packetNames[this.state][direction][type];
  }
  EventEmitter.prototype.on.apply(this, arguments);
};

Client.prototype.onRaw = function(type, func) {
  var arg = "raw.";
  if(Array.isArray(type)) {
    arg += protocol.packetNames[type[0]][direction][type[1]];
  } else if(typeof type === "number") {
    arg += protocol.packetNames[this.state][direction][type];
  } else {
    arg += type;
  }
  arguments[0] = arg;
  EventEmitter.prototype.on.apply(this, arguments);
};

Client.prototype.setSocket = function(socket) {
  var ended = false;

  // TODO : A lot of other things needs to be done.
  var endSocket = () => {
    if(ended) return;
    ended = true;
    this.socket.removeListener('close', endSocket);
    this.socket.removeListener('end', endSocket);
    this.socket.removeListener('timeout', endSocket);
    this.emit('end', this._endReason);
  };

  var onError = (err) => {
    this.emit('error', err);
    endSocket();
  };

  this.socket = socket;

  if(this.socket.setNoDelay)
    this.socket.setNoDelay(true);

  this.socket.on('connect', () => this.emit('connect'));

  this.socket.on('error', onError);
  this.socket.on('close', endSocket);
  this.socket.on('end', endSocket);
  this.socket.on('timeout', endSocket);

  this.socket.pipe(this.splitter).pipe(this.deserializer);
  this.serializer.pipe(this.framer).pipe(this.socket);

  this.deserializer.on('data', (parsed) => {
    var packet = parsed.results;
    var packetName = protocol.packetNames[packet.state][this.isServer ? 'toServer' : 'toClient'][packet.id];
    this.emit('packet', packet);
    this.emit(packetName, packet);
    this.emit('raw.' + packetName, parsed.buffer, packet.state);
    this.emit('raw', parsed.buffer, packet.state);
  });
};

Client.prototype.end = function(reason) {
  this._endReason = reason;
  this.socket.end();
};

Client.prototype.setEncryption = function(sharedSecret) {
  if (this.cipher != null)
    throw new Error("Set encryption twice !");
  this.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
  this.framer.unpipe(this.socket);
  this.framer.pipe(this.cipher).pipe(this.socket);
  this.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
  this.socket.unpipe(this.splitter);
  this.socket.pipe(this.decipher).pipe(this.splitter);
}

Client.prototype.setCompressionThreshold = function(threshold) {
  if (this.compressor == null) {
    this.compressor = compression.createCompressor(threshold);
    this.serializer.unpipe(this.framer);
    this.serializer.pipe(this.compressor).pipe(this.framer);
    this.decompressor = compression.createDecompressor(threshold);
    this.splitter.unpipe(this.deserializer);
    this.splitter.pipe(this.decompressor).pipe(this.deserializer);
  } else {
    this.decompressor.threshold = threshold;
    this.compressor.threshold = threshold;
  }
}

function noop(err) {
  if(err) throw err;
}

Client.prototype.write = function(packetId, params, cb = noop) {
  if(Array.isArray(packetId)) {
    if(packetId[0] !== this.state)
      return false;
    packetId = packetId[1];
  }
  if(typeof packetId === "string")
    packetId = protocol.packetIds[this.state][this.isServer ? "toClient" : "toServer"][packetId];
  var packetName = protocol.packetNames[this.state][this.isServer ? "toClient" : "toServer"][packetId];
  debug("writing packetId " + this.state + "." + packetName + " (0x" + packetId.toString(16) + ")");
  debug(params);
  this.serializer.write({ packetId, params }, cb);
};

Client.prototype.writeRaw = function(buffer) {
  if (this.compressor === null)
    this.framer.write(buffer);
  else
    this.compressor.write(buffer);
};
