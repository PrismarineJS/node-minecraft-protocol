var nbt = require('prismarine-nbt');
var types=require("protodef").types;
var uuid = require('node-uuid');

// TODO : remove type-specific, replace with generic containers and arrays.
module.exports = {
  'UUID': [readUUID, writeUUID, 16],
  'nbt': [readNbt, writeNbt, sizeOfNbt],
  'optionalNbt':[readOptionalNbt,writeOptionalNbt,sizeOfOptionalNbt],
  'restBuffer': [readRestBuffer, writeRestBuffer, sizeOfRestBuffer],
  'entityMetadataLoop': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata]
};

function readUUID(buffer, offset) {
  return {
    value: uuid.unparse(buffer, offset),
    size: 16,
  };
}

function writeUUID(value, buffer, offset) {
  uuid.parse(value, buffer, offset);
  return offset + 16;
}

function readNbt(buffer, offset) {
  return nbt.proto.read(buffer,offset,"nbt");
}

function writeNbt(value, buffer, offset) {
  return nbt.proto.write(value,buffer,offset,"nbt");
}

function sizeOfNbt(value) {
  return nbt.proto.sizeOf(value,"nbt");
}


function readOptionalNbt(buffer, offset) {
  if(buffer.readInt8(offset) == 0) return {size:1};
  return nbt.proto.read(buffer,offset,"nbt");
}

function writeOptionalNbt(value, buffer, offset) {
  if(value==undefined) {
    buffer.writeInt8(0,offset);
    return offset+1;
  }
  return nbt.proto.write(value,buffer,offset,"nbt");
}

function sizeOfOptionalNbt(value) {
  if(value==undefined)
    return 1;
  return nbt.proto.sizeOf(value,"nbt");
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

function sizeOfRestBuffer(value) {
  return value.length;
}

function readEntityMetadata(buffer, offset, typeArgs, context) {
  var cursor = offset;
  var metadata = [];
  var item, key, type, results, reader, typeName, dataType;
  while(true) {
    item = buffer.readUInt8(cursor);
    if(item === typeArgs.endVal) {
      return {
        value: metadata,
        size: cursor + 1 - offset,
      };
    }
    var results = this.read(buffer, cursor, typeArgs.type, {});
    metadata.push(results.value);
    cursor += results.size;
  }
}

function writeEntityMetadata(value, buffer, offset, typeArgs, context) {
  var self = this;
  value.forEach(function(item) {
    offset = self.write(item, buffer, offset, typeArgs.type, {});
  });
  buffer.writeUInt8(typeArgs.endVal, offset);
  return offset + 1;
}

function sizeOfEntityMetadata(value, typeArgs, context) {
  var size = 1;
  for(var i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], typeArgs.type, {});
  }
  return size;
}
