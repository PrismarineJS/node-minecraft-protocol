var nbt = require('prismarine-nbt');
var uuid = require('node-uuid');

module.exports = {
  'UUID': [readUUID, writeUUID],
  'nbt': [readNbt, writeNbt],
  'optionalNbt':[readOptionalNbt,writeOptionalNbt],
  'restBuffer': [readRestBuffer, writeRestBuffer],
  'entityMetadataLoop': [readEntityMetadata, writeEntityMetadata]
};

function readUUID(read) {
  return read(16).then(buffer => uuid.unparse(buffer, 0));
}

function writeUUID(value, write) {
  write(16,buffer => uuid.parse(value, buffer, 0));
}

function readNbt(read) {
  return nbt.proto.read(read,"nbt");
}

function writeNbt(value, write) {
  return nbt.proto.write(value,write,"nbt");
}

function readOptionalNbt(read) {
  return read(1,true)
    .then(buffer => buffer.readInt8(0))
    .then(value => value==0 ? read(1).then(() => undefined) : nbt.proto.read(read,"nbt"));
}

function writeOptionalNbt(value, write) {
  if(value==undefined)
    write(1,buffer => buffer.writeInt8(0,0));
  else
   nbt.proto.write(value,write,"nbt");
}

function readRestBuffer(read) {
  return read(-1);
}

function writeRestBuffer(value, write) {
  write(value.length,buffer => value.copy(buffer,0));
}

async function readEntityMetadata(read, {type,endVal}) {
  var metadata = [];
  var item;
  while(true) {
    item = (await read(1,true)).readUInt8(0);
    if(item === endVal)
      return read(1).then(()=>metadata);
    var results = await this.read(read, type, {});
    metadata.push(results.value);
  }
}

function writeEntityMetadata(value, write, {type,endVal}) {
  value.forEach(item => this.write(item, write, type, {}));
  write(1,buffer => buffer.writeUInt8(endVal, 0));
}
