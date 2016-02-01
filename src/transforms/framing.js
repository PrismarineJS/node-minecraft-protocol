var [readVarInt, writeVarInt, sizeOfVarInt] = require("protodef").types.varint;
var Transform = require("readable-stream").Transform;

module.exports.createSplitter = function() {
  return new Splitter();
};

module.exports.createFramer = function() {
  return new Framer();
};

class Framer extends Transform {
  constructor() {
    super();
  }

  _transform(chunk, enc, cb) {
    var buffer = new Buffer(sizeOfVarInt(chunk.length) + chunk.length);
    writeVarInt(chunk.length, buffer, 0);
    chunk.copy(buffer, sizeOfVarInt(chunk.length));
    this.push(buffer);
    return cb();
  }
}

const LEGACY_PING_PACKET_ID = 0xfe;

class Splitter extends Transform {
  constructor() {
    super();
    this.buffer = new Buffer(0);
    this.recognizeLegacyPing = false;
  }
  _transform(chunk, enc, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (this.recognizeLegacyPing && this.buffer[0] === LEGACY_PING_PACKET_ID) {
      // legacy_server_list_ping packet follows a different protocol format
      // prefix the encoded varint packet id for the deserializer
      var header = new Buffer(sizeOfVarInt(LEGACY_PING_PACKET_ID));
      writeVarInt(LEGACY_PING_PACKET_ID, header, 0);
      var payload = this.buffer.slice(1); // remove 0xfe packet id
      if (payload.length === 0) payload = new Buffer('\0'); // TODO: update minecraft-data to recognize a lone 0xfe, https://github.com/PrismarineJS/minecraft-data/issues/95
      this.push(Buffer.concat([header, payload]));
      return cb();
    }

    var offset = 0;

    var { value, size, error } = readVarInt(this.buffer, offset) || { error: "Not enough data" };
    while (!error && this.buffer.length >= offset + size + value)
    {
      this.push(this.buffer.slice(offset + size, offset + size + value));
      offset += size + value;
      ({ value, size, error } = readVarInt(this.buffer, offset) || { error: "Not enough data" });
    }
    this.buffer = this.buffer.slice(offset);
    return cb();
  }
}

