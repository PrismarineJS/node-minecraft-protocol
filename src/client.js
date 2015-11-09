var EventEmitter = require('events').EventEmitter;
var debug = require('./debug');
var compression = require('./transforms/compression');
var framing = require('./transforms/framing');
var crypto = require('crypto');
var states = require("./states");

var createSerializer=require("./transforms/serializer").createSerializer;
var createDeserializer=require("./transforms/serializer").createDeserializer;

class Client extends EventEmitter
{
  packetsToParse={};
  serializer;
  compressor=null;
  framer=framing.createFramer();
  cipher=null;
  decipher=null;
  splitter=framing.createSplitter();
  decompressor=null;
  deserializer;
  isServer;
  version;
  protocolState=states.HANDSHAKING;

  constructor(isServer,version) {
    super();
    this.version=version;
    this.isServer = !!isServer;
    this.setSerializer(states.HANDSHAKING);

    this.on('newListener', function(event, listener) {
      var direction = this.isServer ? 'toServer' : 'toClient';
      if(typeof this.packetsToParse[event] === "undefined") this.packetsToParse[event] = 1;
      else this.packetsToParse[event] += 1;
    });
    this.on('removeListener', function(event, listener) {
      var direction = this.isServer ? 'toServer' : 'toClient';
      this.packetsToParse[event] -= 1;
    });
  }

  get state(){
    return this.protocolState;
  }


  setSerializer(state) {
    this.serializer = createSerializer({ isServer:this.isServer, version:this.version, state: state});
    this.deserializer = createDeserializer({ isServer:this.isServer, version:this.version, state: state, packetsToParse:
      this.packetsToParse});


    this.serializer.on('error', (e) => {
      var parts=e.field.split(".");
      parts.shift();
      var serializerDirection = !this.isServer ? 'toServer' : 'toClient';
      e.field = [this.protocolState, serializerDirection].concat(parts).join(".");
      e.message = `Serialization error for ${e.field} : ${e.message}`;
      this.emit('error',e);
    });


    this.deserializer.on('error', (e) => {
      var parts=e.field.split(".");
      parts.shift();
      var deserializerDirection = this.isServer ? 'toServer' : 'toClient';
      e.field = [this.protocolState, deserializerDirection].concat(parts).join(".");
      e.message = `Deserialization error for ${e.field} : ${e.message}`;
      this.emit('error',e);
    });

    this.deserializer.on('data', (parsed) => {
      parsed.metadata.name=parsed.data.name;
      parsed.data=parsed.data.params;
      parsed.metadata.state=state;
      this.emit('packet', parsed.data, parsed.metadata);
      this.emit(parsed.metadata.name, parsed.data, parsed.metadata);
      this.emit('raw.' + parsed.metadata.name, parsed.buffer, parsed.metadata);
      this.emit('raw', parsed.buffer, parsed.metadata);
    });
  }

  set state(newProperty) {
    var oldProperty = this.protocolState;
    this.protocolState = newProperty;

    if(!this.compressor)
    {
      this.serializer.unpipe(this.framer);
      this.splitter.unpipe(this.deserializer);
    }
    else
    {
      this.serializer.unpipe(this.compressor);
      this.decompressor.unpipe(this.deserializer);
    }

    this.serializer.removeAllListeners();
    this.deserializer.removeAllListeners();
    this.setSerializer(this.protocolState);

    if(!this.compressor)
    {
      this.serializer.pipe(this.framer);
      this.splitter.pipe(this.deserializer);
    }
    else
    {
      this.serializer.pipe(this.compressor);
      this.decompressor.pipe(this.deserializer);
    }

    this.emit('state', newProperty, oldProperty);
  }

  get compressionThreshold() {
    return this.compressor == null ? -2 : this.compressor.compressionThreshold;
  }

  set compressionThreshold(threshold) {
    this.setCompressionThreshold(threshold);
  }

  setSocket(socket) {
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
    this.framer.on('error', onError);
    this.splitter.on('error', onError);

    this.socket.pipe(this.splitter).pipe(this.deserializer);
    this.serializer.pipe(this.framer).pipe(this.socket);
  }

  end(reason) {
    this._endReason = reason;
    if(this.socket) this.socket.end();
  }

  setEncryption(sharedSecret) {
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

  setCompressionThreshold(threshold) {
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

  write(name, params) {
    debug("writing packet " + this.state + "." + name);
    debug(params);
    this.serializer.write({ name, params });
  }

  writeRaw(buffer) {
    if (this.compressor === null)
      this.framer.write(buffer);
    else
      this.compressor.write(buffer);
  }
}

module.exports = Client;
