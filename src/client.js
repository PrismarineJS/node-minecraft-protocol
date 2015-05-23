var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , debug = require('./debug')
  , serializer = require('./transforms/serializer')
  , compression = require('./transforms/compression')
  , framing = require('./transforms/framing')
  , crypto = require('crypto')
  , states = serializer.states
  ;

var packets = require("../protocol/protocol");
var readPackets = require("./packets").readPackets;
var packetIndexes = readPackets(packets, states);

module.exports = Client;

function Client(isServer) {
  EventEmitter.call(this);

  var socket;
  this.packetsToParse = {};

  this.serializer = serializer.createSerializer({ isServer });
  this.compressor = null;
  this.framer = framing.createFramer();
  this.cipher = null;

  this.decipher = null;
  this.splitter = framing.createSplitter();
  this.decompressor = null;
  this.deserializer = serializer.createDeserializer({ isServer, packetsToParse: this.packetsToParse });

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

  this.on('newListener', function(event, listener) {
    var direction = this.isServer ? 'toServer' : 'toClient';
    if(packetIndexes.packetStates[direction].hasOwnProperty(event) || event === "packet") {
      if(typeof this.packetsToParse[event] === "undefined") this.packetsToParse[event] = 1;
      else this.packetsToParse[event] += 1;
    }
  });
  this.on('removeListener', function(event, listener) {
    var direction = this.isServer ? 'toServer' : 'toClient';
    if(packetIndexes.packetStates[direction].hasOwnProperty(event) || event === "packet") {
      this.packetsToParse[event] -= 1;
    }
  });
}

util.inherits(Client, EventEmitter);

// Transform weird "packet" types into string representing their type. Should be mostly retro-compatible
Client.prototype.on = function(type, func) {
  var direction = this.isServer ? 'toServer' : 'toClient';
  if(Array.isArray(type)) {
    arguments[0] = packetIndexes.packetNames[type[0]][direction][type[1]];
  } else if(typeof type === "number") {
    arguments[0] = packetIndexes.packetNames[this.state][direction][type];
  }
  EventEmitter.prototype.on.apply(this, arguments);
};

Client.prototype.onRaw = function(type, func) {
  var arg = "raw.";
  if(Array.isArray(type)) {
    arg += packetIndexes.packetNames[type[0]][direction][type[1]];
  } else if(typeof type === "number") {
    arg += packetIndexes.packetNames[this.state][direction][type];
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

  var onFatalError = (err) => {
    this.emit('error', err);
    endSocket();
  };

  var onError = (err) => this.emit('error', err);

  this.socket = socket;

  if(this.socket.setNoDelay)
    this.socket.setNoDelay(true);

  this.socket.on('connect', () => this.emit('connect'));

  this.socket.on('error', onFatalError);
  this.socket.on('close', endSocket);
  this.socket.on('end', endSocket);
  this.socket.on('timeout', endSocket);
  this.serializer.on('error', onError);
  this.deserializer.on('error', onError);
  this.framer.on('error', onError);
  this.splitter.on('error', onError);

  this.socket.pipe(this.splitter).pipe(this.deserializer);
  this.serializer.pipe(this.framer).pipe(this.socket);

  this.deserializer.on('data', (parsed) => {
    var packet = parsed.results;
    var packetName = packetIndexes.packetNames[packet.state][this.isServer ? 'toServer' : 'toClient'][packet.id];
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
  this.cipher.on('error', (err) => this.emit('error', err));
  this.framer.unpipe(this.socket);
  this.framer.pipe(this.cipher).pipe(this.socket);
  this.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
  this.decipher.on('error', (err) => this.emit('error', err));
  this.socket.unpipe(this.splitter);
  this.socket.pipe(this.decipher).pipe(this.splitter);
}

Client.prototype.setCompressionThreshold = function(threshold) {
  if (this.compressor == null) {
    this.compressor = compression.createCompressor(threshold);
    this.compressor.on('error', (err) => this.emit('error', err));
    this.serializer.unpipe(this.framer);
    this.serializer.pipe(this.compressor).pipe(this.framer);
    this.decompressor = compression.createDecompressor(threshold);
    this.decompressor.on('error', (err) => this.emit('error', err));
    this.splitter.unpipe(this.deserializer);
    this.splitter.pipe(this.decompressor).pipe(this.deserializer);
  } else {
    this.decompressor.threshold = threshold;
    this.compressor.threshold = threshold;
  }
}

Client.prototype.write = function(packetId, params) {
  if(Array.isArray(packetId)) {
    if(packetId[0] !== this.state)
      return false;
    packetId = packetId[1];
  }
  if(typeof packetId === "string")
    packetId = packetIndexes.packetIds[this.state][this.isServer ? "toClient" : "toServer"][packetId];
  var packetName = packetIndexes.packetNames[this.state][this.isServer ? "toClient" : "toServer"][packetId];
  debug("writing packetId " + this.state + "." + packetName + " (0x" + packetId.toString(16) + ")");
  debug(params);
  this.serializer.write({ packetId, params });
};

Client.prototype.writeRaw = function(buffer) {
  if (this.compressor === null)
    this.framer.write(buffer);
  else
    this.compressor.write(buffer);
};
