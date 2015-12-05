var zlib = require("zlib");
var Transform = require("readable-stream").Transform;

module.exports.createCompressor = function(threshold) {
  return new Compressor(threshold);
};

module.exports.createDecompressor = function(threshold) {
  return new Decompressor(threshold);
};

var [readVarInt,writeVarIntOri] = require("protodef").types.varint;
var DataGetter = require('protodef').DataGetter;

var writeVarInt=(value) => {
  var transformedBuffer=new Buffer(0);
  writeVarIntOri(value,(size,f)=> {
    var buffer=new Buffer(size);
    f(buffer);
    transformedBuffer=Buffer.concat([transformedBuffer,buffer]);
  });
  return transformedBuffer;
};

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
        var buf=writeVarInt(chunk.length);
        this.push(Buffer.concat([buf,newChunk]));
        return cb();
      });
    }
    else
    {
      var buf=writeVarInt(0);
      this.push(Buffer.concat([buf,chunk]));
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

    var dataGetter=new DataGetter();
    dataGetter.push(chunk);

    readVarInt(dataGetter.get.bind(this.dataGetter))
    .then(value => {
      if (value === 0)
      {
        this.push(dataGetter.incomingBuffer);
        return cb();
      }
      else
      {
        zlib.inflate(dataGetter.incomingBuffer, (err, newBuf) => {
          if (err)
            return cb(err);
          this.push(newBuf);
          return cb();
        });
      }
    })
    .catch(cb);
  }
}
