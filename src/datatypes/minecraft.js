var nbt = require('prismarine-nbt');
var utils = require("./utils");
var numeric = require("./numeric");

// TODO : remove type-specific, replace with generic containers and arrays.
module.exports = {
  'UUID': [readUUID, writeUUID, 16],
  'position': [readPosition, writePosition, 8],
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'nbt': [readNbt, utils.buffer[1], utils.buffer[2]],
  'restBuffer': [readRestBuffer, utils.buffer[1], utils.buffer[2]],
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata]
};

function readUUID(buffer, offset) {
  return {
    value: [
      buffer.readUInt32BE(offset),
      buffer.readUInt32BE(offset + 4),
      buffer.readUInt32BE(offset + 8),
      buffer.readUInt32BE(offset + 12),
    ],
    size: 16,
  };
}

function writeUUID(value, buffer, offset) {
  buffer.writeUInt32BE(value[0], offset);
  buffer.writeUInt32BE(value[1], offset + 4);
  buffer.writeUInt32BE(value[2], offset + 8);
  buffer.writeUInt32BE(value[3], offset + 12);
  return offset + 16;
}


function readPosition(buffer, offset) {
  var longVal = numeric.long[0](buffer, offset).value;
  var x = signExtend26(longVal[0] >> 6);
  var y = signExtend12(((longVal[0] & 0x3f) << 6) | ((longVal[1] >> 26) & 0x3f));
  var z = signExtend26(longVal[1] & 0x3FFFFFF);
  return {
    value: {x: x, y: y, z: z},
    size: 8
  };
}
function signExtend26(value) {
  if(value > 0x2000000) value -= 0x4000000;
  return value;
}
function signExtend12(value) {
  if(value > 0x800) value -= 0x1000;
  return value;
}


function writePosition(value, buffer, offset) {
  var longVal = [];
  longVal[0] = ((value.x & 0x3FFFFFF) << 6) | ((value.y & 0xFFF) >> 6);
  longVal[1] = ((value.y & 0x3F) << 26) | (value.z & 0x3FFFFFF);
  return numeric.long[1](longVal, buffer, offset);
}


function readSlot(buffer, offset) {
  var value = {};
  var results = numeric.short[0](buffer, offset);
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


function readRestBuffer(buffer, offset, typeArgs, rootNode) {
  return {
    value: buffer.slice(offset),
    size: buffer.length - offset
  };
}


var entityMetadataTypes = {
  0: {type: 'byte'},
  1: {type: 'short'},
  2: {type: 'int'},
  3: {type: 'float'},
  4: {type: 'string'},
  5: {type: 'slot'},
  6: {
    type: 'container', typeArgs: {
      fields: [
        {name: 'x', type: 'int'},
        {name: 'y', type: 'int'},
        {name: 'z', type: 'int'}
      ]
    }
  },
  7: {
    type: 'container', typeArgs: {
      fields: [
        {name: 'pitch', type: 'float'},
        {name: 'yaw', type: 'float'},
        {name: 'roll', type: 'float'}
      ]
    }
  }
};

// maps string type name to number
var entityMetadataTypeBytes = {};
for(var n in entityMetadataTypes) {
  if(!entityMetadataTypes.hasOwnProperty(n)) continue;

  entityMetadataTypeBytes[entityMetadataTypes[n].type] = n;
}


function readEntityMetadata(buffer, offset) {
  var cursor = offset;
  var metadata = [];
  var item, key, type, results, reader, typeName, dataType;
  while(true) {
    if(cursor + 1 > buffer.length) return null;
    item = buffer.readUInt8(cursor);
    cursor += 1;
    if(item === 0x7f) {
      return {
        value: metadata,
        size: cursor - offset,
      };
    }
    key = item & 0x1f;
    type = item >> 5;
    dataType = entityMetadataTypes[type];
    typeName = dataType.type;
    //debug("Reading entity metadata type " + dataType + " (" + ( typeName || "unknown" ) + ")");
    if(!dataType) {
      return {
        error: new Error("unrecognized entity metadata type " + type)
      }
    }
    results = this.read(buffer, cursor, dataType, {});
    if(!results) return null;
    metadata.push({
      key: key,
      value: results.value,
      type: typeName,
    });
    cursor += results.size;
  }
}


function writeEntityMetadata(value, buffer, offset) {
  var self = this;
  value.forEach(function(item) {
    var type = entityMetadataTypeBytes[item.type];
    var headerByte = (type << 5) | item.key;
    buffer.writeUInt8(headerByte, offset);
    offset += 1;
    offset = self.write(item.value, buffer, offset, entityMetadataTypes[type], {});
  });
  buffer.writeUInt8(0x7f, offset);
  return offset + 1;
}


function sizeOfEntityMetadata(value) {
  var size = 1 + value.length;
  var item;
  for(var i = 0; i < value.length; ++i) {
    item = value[i];
    size += this.sizeOf(item.value, entityMetadataTypes[entityMetadataTypeBytes[item.type]], {});
  }
  return size;
}
