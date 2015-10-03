var [readVarInt, writeVarInt, sizeOfVarInt] = require("protodef").types.varint;
var Transform = require("readable-stream").Transform;

module.exports.createSplitter = function() {
  return new Splitter();
}

module.exports.createFramer = function() {
  return new Framer();
}

class Framer extends Transform {
  constructor() {
    super();
  }

  _transform(chunk, enc, cb) {
    var buffer = new Buffer(sizeOfVarInt(chunk.length));
    writeVarInt(chunk.length, buffer, 0);
    this.push(buffer);
    this.push(chunk);
    return cb();
  }
}

class Splitter extends Transform {
  constructor() {
    super();
    this.buffer = new Buffer(0);
  }
  _transform(chunk, enc, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    var value, size, error;
    var offset = 0;

    ({ value, size, error } = readVarInt(this.buffer, offset) || { error: "Not enough data" });
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

