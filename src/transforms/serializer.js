var [readVarInt, writeVarInt, sizeOfVarInt] = require("../datatypes/utils").varint;
var protocol = require("../protocol");
var Transform = require("readable-stream").Transform;

module.exports.createSerializer = function(obj) {
  return new Serializer(obj);
}

module.exports.createDeserializer = function(obj) {
  return new Deserializer(obj);
}

class Serializer extends Transform {
  constructor({ state = protocol.states.HANDSHAKING, isServer = false } = {}) {
    super({ writableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
  }

  // TODO : Might make sense to make createPacketBuffer async.
  _transform(chunk, enc, cb) {
    try {
      var buf = protocol.createPacketBuffer(chunk.packetId, this.protocolState, chunk.params, this.isServer);
      this.push(buf);
      return cb();
    } catch (e) {
      return cb(e);
    }
  }
}

class Deserializer extends Transform {
  constructor({ state = protocol.states.HANDSHAKING, isServer = false } = {}) {
    super({ readableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
    this.calls = 0;
  }

  _transform(chunk, enc, cb) {
    this.calls++;
    var packet;
    try {
      packet = protocol.parsePacketData(chunk, this.protocolState, this.isServer, this.packetsToParse);
    } catch (e) {
      return cb(e);
    }
    if (packet.error)
    {
      packet.error.packet = packet;
      return cb(packet.error)
    }
    else
    {
      this.push(packet);
      return cb();
    }
  }
}
