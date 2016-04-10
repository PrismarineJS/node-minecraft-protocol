const [readVarInt, writeVarInt, sizeOfVarInt] = require("protodef").types.varint;
import zlib from "zlib";
import { Transform } from "readable-stream";

export function createCompressor(threshold) {
  return new Compressor(threshold);
}

export function createDecompressor(threshold) {
  return new Decompressor(threshold);
}

class Compressor extends Transform {
  constructor(compressionThreshold = -1) {
    super();
    this.compressionThreshold = compressionThreshold;
  }

  _transform(chunk, enc, cb) {
    if (chunk.length >= this.compressionThreshold)
    {
      zlib.deflate(chunk, (err, newChunk) => {
        if (err)
          return cb(err);
        const buf = new Buffer(sizeOfVarInt(chunk.length) + newChunk.length);
        const offset = writeVarInt(chunk.length, buf, 0);
        newChunk.copy(buf, offset);
        this.push(buf);
        return cb();
      });
    }
    else
    {
      const buf = new Buffer(sizeOfVarInt(0) + chunk.length);
      const offset = writeVarInt(0, buf, 0);
      chunk.copy(buf, offset);
      this.push(buf);
      return cb();
    }
  }
}

class Decompressor extends Transform {
  constructor(compressionThreshold = -1) {
    super();
    this.compressionThreshold = compressionThreshold;
  }

  _transform(chunk, enc, cb) {
    const { size, value, error } = readVarInt(chunk, 0);
    if (error)
      return cb(error);
    if (value === 0)
    {
      this.push(chunk.slice(size));
      return cb();
    }
    else
    {
      zlib.inflate(chunk.slice(size), (err, newBuf) => {
        if (err)
          return cb(err);
        this.push(newBuf);
        return cb();
      });
    }
  }
}
