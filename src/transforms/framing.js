
var Transform = require("readable-stream").Transform;

module.exports.createSplitter = function() {
  return new Splitter();
};

module.exports.createFramer = function() {
  return new Framer();
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

class Framer extends Transform {
  constructor() {
    super();
  }

  _transform(chunk, enc, cb) {
    // can probably push the small buffers
    this.push(writeVarInt(chunk.length));
    this.push(chunk);
    return cb();
  }
}

class Splitter extends Transform {
  dataGetter = new DataGetter();
  constructor() {
    super();
    this.gettingData();
  }

  gettingData()
  {
    return readVarInt(this.dataGetter.get.bind(this.dataGetter))
      .then(this.dataGetter.get.bind(this.dataGetter))
    .then(value => {
      this.push(value);
    })
    .then(() => this.gettingData());
  }

  _transform(chunk, enc, cb) {
    this.dataGetter.push(chunk);
    this.dataGetter.asker.once('needMoreData',cb);
  }
}

