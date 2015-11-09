var nbt = require('prismarine-nbt');
var types=require("protodef").types;
var uuid = require('node-uuid');

// TODO : remove type-specific, replace with generic containers and arrays.
module.exports = {
  'UUID': [readUUID, writeUUID, 16],
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'nbt': [readNbt, types.buffer[1], types.buffer[2]],
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

function readSlot(buffer, offset) {
  var value = {};
  var results = types.short[0](buffer, offset);
  if(!results) return null;
  value.blockId = results.value;

  if(value.blockId === -1) {
    return {
      value: value,
      size: 2,
    };
  }

  var cursorEnd = offset + 6;
  if(cursorEnd > buffer.length) return null;
  value.itemCount = buffer.readInt8(offset + 2);
  value.itemDamage = buffer.readInt16BE(offset + 3);
  var nbtData = buffer.readInt8(offset + 5);
  if(nbtData == 0) {
    return {
      value: value,
      size: 6
    }
  }
  var nbtData = readNbt(buffer, offset + 5);
  value.nbtData = nbtData.value;
  return {
    value: value,
    size: nbtData.size + 5
  };
}

function writeSlot(value, buffer, offset) {
  buffer.writeInt16BE(value.blockId, offset);
  if(value.blockId === -1) return offset + 2;
  buffer.writeInt8(value.itemCount, offset + 2);
  buffer.writeInt16BE(value.itemDamage, offset + 3);
  var nbtDataLen;
  if(value.nbtData) {
    var newbuf = nbt.writeUncompressed(value.nbtData);
    newbuf.copy(buffer, offset + 5);
    nbtDataLen = newbuf.length;
  }
  else {
    buffer.writeInt8(0, offset + 5);
    nbtDataLen = 1;
  }
  return offset + 5 + nbtDataLen;
}

function sizeOfSlot(value) {
  if(value.blockId === -1)
    return (2);
  else if(!value.nbtData) {
    return (6);
  } else {
    return (5 + sizeOfNbt(value.nbtData));
  }
}


function readNbt(buffer, offset) {
  buffer = buffer.slice(offset);
  return nbt.parseUncompressed(buffer);
}

function writeNbt(value, buffer, offset) {
  var newbuf = nbt.writeUncompressed(value);
  newbuf.copy(buffer, offset);
  return offset + newbuf.length;
}

function sizeOfNbt(value) {
  return nbt.writeUncompressed(value).length;
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
