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
  read(16).then(buffer => uuid.unparse(buffer, 0));
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
  return read(1)
    .then(buffer => buffer.readInt8(0))
    .then(value => value==0 ? undefined : nbt.proto.read(read,"nbt"));
}

function writeOptionalNbt(value, write) {
  if(value==undefined)
    write(1,buffer => buffer.writeInt8(0,0));
  else
   nbt.proto.write(value,write,"nbt");
}

function readRestBuffer(buffer, offset) {
  return {
    value: buffer.slice(offset),
    size: buffer.length - offset
  };
}

function writeRestBuffer(value, buffer, offset) {
  value.copy(buffer, offset);
  return offset + value.length;
}

async function readEntityMetadata(read, {type,endVal}) {
  var metadata = [];
  var item;
  while(true) {
    item = (await read(1)).readUInt8(cursor);
    if(item === endVal) {
      return metadata;
    }
    var results = await this.read(read, type, {});
    metadata.push(results.value);
  }
}

function writeEntityMetadata(value, write, {type,endVal}) {
  value.forEach(item => this.write(item, write, type, {}));
  write(1,buffer => buffer.writeUInt8(endVal, 0));
}
