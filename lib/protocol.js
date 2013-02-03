var assert = require('assert');

var STRING_MAX_LENGTH = 240;

var packets = {
  0x00: [
    { name: "keepAliveId", type: "int" }
  ],
  0x01: [
    { name: "entityId", type: "int" },
    { name: "levelType", type: "string" },
    { name: "gameMode", type: "byte" },
    { name: "dimension", type: "byte" },
    { name: "difficulty", type: "byte" },
    { name: null, type: "byte" },
    { name: "maxPlayers", type: "byte" }
  ],
  0x02: [
    { name: "protocolVersion", type: "byte" },
    { name: "username", type: "string" },
    { name: "serverHost", type: "string" },
    { name: "serverPort", type: "int" }
  ],
  0x03: [
    { name: "message", type: "string" }
  ],
  0x04: [
    { name: "age", type: "long" },
    { name: "time", type: "long" }
  ],
  0x05: [
    { name: "entityId", type: "int" },
    { name: "slot", type: "short" },
    { name: "item", type: "slot" }
  ],
  0x06: [
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" }
  ],
  0x07: [
    { name: "user", type: "int" },
    { name: "target", type: "int" },
    { name: "leftClick", type: "bool" }
  ],
  0x08: [
    { name: "health", type: "short" },
    { name: "food", type: "short" },
    { name: "foodSaturation", type: "float" }
  ],
  0x09: [
    { name: "dimension", type: "int" },
    { name: "difficulty", type: "byte" },
    { name: "gameMode", type: "byte" },
    { name: "worldHeight", type: "short" },
    { name: "levelType", type: "string" }
  ],
  0x0a: [
    { name: "onGround", type: "bool" }
  ],
  0x0b: [
    { name: "x", type: "double" },
    { name: "y", type: "double" },
    { name: "stance", type: "double" },
    { name: "z", type: "double" },
    { name: "onGround", type: "bool" }
  ],
  0x0c: [
    { name: "yaw", type: "float" },
    { name: "pitch", type: "float" },
    { name: "onGround", type: "bool" }
  ],
  0x0d: {
    toServer: [
      { name: "x", type: "double" },
      { name: "y", type: "double" },
      { name: "stance", type: "double" },
      { name: "z", type: "double" },
      { name: "yaw", type: "float" },
      { name: "pitch", type: "float" },
      { name: "onGround", type: "bool" }
    ],
    toClient: [
      { name: "x", type: "double" },
      { name: "stance", type: "double" },
      { name: "y", type: "double" },
      { name: "z", type: "double" },
      { name: "yaw", type: "float" },
      { name: "pitch", type: "float" },
      { name: "onGround", type: "bool" }
    ],
  },
  0x0e: [
    { name: "status", type: "byte" },
    { name: "x", type: "int" },
    { name: "y", type: "ubyte" },
    { name: "z", type: "int" },
    { name: "face", type: "ubyte" }
  ],
  0x0f: [
    { name: "x", type: "int" },
    { name: "y", type: "ubyte" },
    { name: "z", type: "int" },
    { name: "direction", type: "byte" },
    { name: "heldItem", type: "slot" },
    { name: "cursorX", type: "byte" },
    { name: "cursorY", type: "byte" },
    { name: "cursorZ", type: "byte" }
  ],
  0x10: [
    { name: "slotId", type: "short" }
  ],
  0x11: [
    { name: "entityId", type: "int" },
    { name: null, type: "byte" },
    { name: "x", type: "int" },
    { name: "y", type: "ubyte" },
    { name: "z", type: "int" }
  ],
  0x12: [
    { name: "entityId", type: "int" },
    { name: "animation", type: "byte" }
  ],
  0x13: [
    { name: "entityId", type: "int" },
    { name: "actionId", type: "byte" }
  ],
  0x14: [
    { name: "entityId", type: "int" },
    { name: "name", type: "string" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" },
    { name: "currentItem", type: "short" },
    { name: "metadata", type: "entityMetadata" }
  ],
  0x16: [
    { name: "collectedId", type: "int" },
    { name: "collectorId", type: "int" }
  ],
  0x17: [
    { name: "entityId", type: "int" },
    { name: "type", type: "byte" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" },
    { name: "objectData", type: "objectData" }
  ],
  0x18: [
    { name: "entityId", type: "int" },
    { name: "type", type: "byte" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" },
    { name: "headYaw", type: "byte" },
    { name: "velocityX", type: "short" },
    { name: "velocityY", type: "short" },
    { name: "velocityZ", type: "short" },
    { name: "metadata", type: "entityMetadata" }
  ],
  0x19: [
    { name: "entityId", type: "int" },
    { name: "name", type: "string" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "direction", type: "int" }
  ],
  0x1a: [
    { name: "entityId", type: "int" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "count", type: "short" }
  ],
  0x1c: [
    { name: "entityId", type: "int" },
    { name: "velocityX", type: "short" },
    { name: "velocityY", type: "short" },
    { name: "velocityZ", type: "short" }
  ],
  0x1d: [
    { name: "entityIds", type: "intArray8" }
  ],
  0x1e: [
    { name: "entityId", type: "int" }
  ],
  0x1f: [
    { name: "entityId", type: "int" },
    { name: "dx", type: "byte" },
    { name: "dy", type: "byte" },
    { name: "dz", type: "byte" }
  ],
  0x20: [
    { name: "entityId", type: "int" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" }
  ],
  0x21: [
    { name: "entityId", type: "int" },
    { name: "dx", type: "byte" },
    { name: "dy", type: "byte" },
    { name: "dz", type: "byte" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" }
  ],
  0x22: [
    { name: "entityId", type: "int" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "yaw", type: "byte" },
    { name: "pitch", type: "byte" }
  ],
  0x23: [
    { name: "entityId", type: "int" },
    { name: "headYaw", type: "byte" }
  ],
  0x26: [
    { name: "entityId", type: "int" },
    { name: "status", type: "byte" }
  ],
  0x27: [
    { name: "entityId", type: "int" },
    { name: "vehicleId", type: "int" }
  ],
  0x28: [
    { name: "entityId", type: "int" },
    { name: "metadata", type: "entityMetadata" }
  ],
  0x29: [
    { name: "entityId", type: "int" },
    { name: "effectId", type: "byte" },
    { name: "amplifier", type: "byte" },
    { name: "duration", type: "short" }
  ],
  0x2a: [
    { name: "entityId", type: "int" },
    { name: "effectId", type: "byte" }
  ],
  0x2b: [
    { name: "experienceBar", type: "float" },
    { name: "level", type: "short" },
    { name: "totalExperience", type: "short" }
  ],
  0x33: [
    { name: "x", type: "int" },
    { name: "z", type: "int" },
    { name: "groundUp", type: "bool" },
    { name: "bitMap", type: "ushort" },
    { name: "addBitMap", type: "ushort" },
    { name: "compressedChunkData", type: "byteArray32" }
  ],
  0x34: [
    { name: "chunkX", type: "int" },
    { name: "chunkZ", type: "int" },
    { name: "recordCount", type: "short" },
    { name: "data", type: "byteArray32" }
  ],
  0x35: [
    { name: "x", type: "int" },
    { name: "y", type: "ubyte" },
    { name: "z", type: "int" },
    { name: "type", type: "short" },
    { name: "metadata", type: "byte" }
  ],
  0x36: [
    { name: "x", type: "int" },
    { name: "y", type: "short" },
    { name: "z", type: "int" },
    { name: "byte1", type: "byte" },
    { name: "byte2", type: "byte" },
    { name: "blockId", type: "short" }
  ],
  0x37: [
    { name: "entityId", type: "int" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "destroyStage", type: "byte" }
  ],
  0x38: [
    { name: "data", type: "mapChunkBulk" }
  ],
  0x3c: [
    { name: "x", type: "double" },
    { name: "y", type: "double" },
    { name: "z", type: "double" },
    { name: "radius", type: "float" },
    { name: "affectedBlockOffsets", type: "byteVectorArray" },
    { name: "playerMotionX", type: "float" },
    { name: "playerMotionY", type: "float" },
    { name: "playerMotionZ", type: "float" }
  ],
  0x3d: [
    { name: "effectId", type: "int" },
    { name: "x", type: "int" },
    { name: "y", type: "ubyte" },
    { name: "z", type: "int" },
    { name: "data", type: "int" },
    { name: "global", type: "bool" }
  ],
  0x3e: [
    { name: "soundName", type: "string" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" },
    { name: "volume", type: "float" },
    { name: "pitch", type: "byte" }
  ],
  0x46: [
    { name: "reason", type: "byte" },
    { name: "gameMode", type: "byte" }
  ],
  0x47: [
    { name: "entityId", type: "int" },
    { name: "type", type: "byte" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" }
  ],
  0x64: [
    { name: "windowId", type: "byte" },
    { name: "inventoryType", type: "byte" },
    { name: "windowTitle", type: "string" },
    { name: "slotCount", type: "byte" }
  ],
  0x65: [
    { name: "windowId", type: "byte" }
  ],
  0x66: [
    { name: "windowId", type: "byte" },
    { name: "slot", type: "short" },
    { name: "mouseButton", type: "byte" },
    { name: "action", type: "short" },
    { name: "shift", type: "bool" },
    { name: "item", type: "slot" }
  ],
  0x67: [
    { name: "windowId", type: "byte" },
    { name: "slot", type: "short" },
    { name: "item", type: "slot" }
  ],
  0x68: [
    { name: "windowId", type: "byte" },
    { name: "items", type: "slotArray" }
  ],
  0x69: [
    { name: "windowId", type: "byte" },
    { name: "property", type: "short" },
    { name: "value", type: "short" }
  ],
  0x6a: [
    { name: "windowId", type: "byte" },
    { name: "action", type: "short" },
    { name: "accepted", type: "bool" }
  ],
  0x6b: [
    { name: "slot", type: "short" },
    { name: "item", type: "slot" }
  ],
  0x6c: [
    { name: "windowId", type: "byte" },
    { name: "enchantment", type: "byte" }
  ],
  0x82: [
    { name: "x", type: "int" },
    { name: "y", type: "short" },
    { name: "z", type: "int" },
    { name: "text1", type: "string" },
    { name: "text2", type: "string" },
    { name: "text3", type: "string" },
    { name: "text4", type: "string" }
  ],
  0x83: [
    { name: "type", type: "short" },
    { name: "itemId", type: "short" },
    { name: "text", type: "ascii" }
  ],
  0x84: [
    { name: "x", type: "int" },
    { name: "y", type: "short" },
    { name: "z", type: "int" },
    { name: "action", type: "byte" },
    { name: "nbtData", type: "byteArray16" }
  ],
  0xc8: [
    { name: "statisticId", type: "int" },
    { name: "amount", type: "byte" }
  ],
  0xc9: [
    { name: "playerName", type: "string" },
    { name: "online", type: "bool" },
    { name: "ping", type: "short" }
  ],
  0xca: [
    { name: "flags", type: "byte" },
    { name: "flyingSpeed", type: "byte" },
    { name: "walkingSpeed", type: "byte" }
  ],
  0xcb: [
    { name: "text", type: "string" }
  ],
  0xcc: [
    { name: "locale", type: "string" },
    { name: "viewDistance", type: "byte" },
    { name: "chatFlags", type: "byte" },
    { name: "difficulty", type: "byte" },
    { name: "showCape", type: "bool" }
  ],
  0xcd: [
    { name: "payload", type: "byte" }
  ],
  0xfa: [
    { name: "channel", type: "string" },
    { name: "data", type: "byteArray16" }
  ],
  0xfc: [
    { name: "sharedSecret", type: "byteArray16" },
    { name: "verifyToken", type: "byteArray16" }
  ],
  0xfd: [
    { name: "serverId", type: "string" },
    { name: "publicKey", type: "byteArray16" },
    { name: "verifyToken", type: "byteArray16" }
  ],
  0xfe: [
    { name: "magic", type: "byte" }
  ],
  0xff: [
    { name: "reason", type: "string" }
  ]
};

var types = {
  'int': [readInt, IntWriter],
  'short': [readShort, ShortWriter],
  'ushort': [readUShort, UShortWriter],
  'byte': [readByte, ByteWriter],
  'ubyte': [readUByte, UByteWriter],
  'string': [readString, StringWriter],
  'byteArray16': [readByteArray16, ByteArray16Writer],
  'bool': [readBool, BoolWriter],
  'double': [readDouble, DoubleWriter],
  'float': [readFloat, FloatWriter],
  'slot': [readSlot, SlotWriter],
  'long': [readLong, LongWriter],
  'ascii': [readAscii, AsciiWriter],
  'entityMetadata': [readEntityMetadata, EntityMetadataWriter],
  'byteArray32': [readByteArray32, ByteArray32Writer],
  'slotArray': [readSlotArray, SlotArrayWriter],
  'mapChunkBulk': [readMapChunkBulk, MapChunkBulkWriter],
  'objectData': [readObjectData, ObjectDataWriter],
  'intArray8': [readIntArray8, IntArray8Writer],
  'intVector': [readIntVector, IntVectorWriter],
  'byteVector': [readByteVector, ByteVectorWriter],
  'byteVectorArray': [readByteVectorArray, ByteVectorArrayWriter],
};

function ByteArray32Writer(value) {
  this.value = value;
  this.size = 4 + value.length;
}

ByteArray32Writer.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value.length, offset);
  this.value.copy(buffer, offset + 4);
}

function SlotArrayWriter(value) {
  this.value = new Array(value.length)
  this.size = 2;
  var slotWriter;
  for (var i = 0; i < value.length; ++i) {
    this.value[i] = slotWriter = new SlotWriter(value[i]);
    this.size += slotWriter.size;
  }
}

SlotArrayWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  offset += 2;
  this.value.forEach(function(slotWriter) {
    slotWriter.write(buffer, offset);
    offset += slotWriter.size;
  });
}

var entityMetadataTypes = {
  0: 'byte',
  1: 'short',
  2: 'int',
  3: 'float',
  4: 'string',
  5: 'slot',
  6: 'intVector',
};

// maps string type name to number
var entityMetadataTypeBytes = {};
for (var n in entityMetadataTypes) {
  entityMetadataTypeBytes[entityMetadataTypes[n]] = n;
}

function EntityMetadataWriter(value) {
  this.value = [];
  this.size = 1 + value.length;
  var item, Writer, writer, dataType;
  for (var i = 0; i < value.length; ++i) {
    item = value[i];
    dataType = types[item.type];
    assert.ok(dataType, "unknown data type " + dataType);
    Writer = dataType[1];
    assert.ok(Writer, "missing writer for data type " + item.type);
    writer = new Writer(item.value);
    this.size += writer.size;
    this.value.push({
      writer: writer,
      key: item.key,
      type: entityMetadataTypeBytes[item.type],
    });
  }
}

EntityMetadataWriter.prototype.write = function(buffer, offset) {
  this.value.forEach(function(item) {
    var headerByte = (item.type << 5) | item.key;
    buffer.writeUInt8(headerByte, offset);
    offset += 1;
    item.writer.write(buffer, offset);
    offset += item.writer.size;
  });
  buffer.writeUInt8(0x7f, offset);
}

function ObjectDataWriter(value) {
  this.value = value;
  this.size = value.intField === 0 ? 4 : 10;
}

ObjectDataWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value.intField, offset);
  if (this.value.intField === 0) return;
  offset += 4;

  buffer.writeInt16BE(this.value.velocityX, offset);
  offset += 2;
  buffer.writeInt16BE(this.value.velocityY, offset);
  offset += 2;
  buffer.writeInt16BE(this.value.velocityZ, offset);
}

function MapChunkBulkWriter(value) {
  this.value = value;
  this.size = 7 + value.compressedChunkData.length + 12 * value.meta.length;
}

MapChunkBulkWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.meta.length, offset);
  offset += 2;
  buffer.writeInt32BE(this.value.compressedChunkData.length, offset);
  offset += 4;
  buffer.writeInt8(+this.value.skyLightSent, offset);
  offset += 1;

  this.value.compressedChunkData.copy(buffer, offset);
  offset += this.value.compressedChunkData.length;

  var meta;
  for (var i = 0; i < this.value.meta.length; ++i) {
    meta = this.value.meta[i];
    buffer.writeInt32BE(meta.x, offset);
    offset += 4;
    buffer.writeInt32BE(meta.z, offset);
    offset += 4;
    buffer.writeUInt16BE(meta.bitMap, offset);
    offset += 2;
    buffer.writeUInt16BE(meta.addBitMap, offset);
    offset += 2;
  }
}

function IntArray8Writer(value) {
  this.value = value;
  this.size = 1 + 4 * value.length;
}

IntArray8Writer.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value.length, offset);
  offset += 1;

  this.value.forEach(function(item) {
    buffer.writeInt32BE(item, offset);
    offset += 4;
  });
}

function IntVectorWriter(value) {
  this.value = value;
  this.size = 12;
}

IntVectorWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value.x, offset);
  buffer.writeInt32BE(this.value.y, offset + 4);
  buffer.writeInt32BE(this.value.z, offset + 8);
}

function ByteVectorWriter(value) {
  this.value = value;
  this.size = 3;
}

ByteVectorWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value.x, offset);
  buffer.writeInt8(this.value.y, offset + 1);
  buffer.writeInt8(this.value.z, offset + 2);
}

function ByteVectorArrayWriter(value) {
  this.value = value;
  this.size = 4 + 3 * value.length;
}

ByteVectorArrayWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value.length, offset);
  offset += 4;
  this.value.forEach(function(vec) {
    buffer.writeInt8(vec.x, offset);
    offset += 1;
    buffer.writeInt8(vec.y, offset);
    offset += 1;
    buffer.writeInt8(vec.z, offset);
    offset += 1;
  });
}

function readIntArray8(buffer, offset) {
  var results = readByte(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var cursorEnd = cursor + 4 * count;
  if (cursorEnd > buffer.length) return null;
  var array = [];
  for (var i = 0; i < count; ++i) {
    array.push(buffer.readInt32BE(cursor));
    cursor += 4;
  }

  return {
    value: array,
    size: cursorEnd - offset,
  };
}


function readByteVectorArray(buffer, offset) {
  var results = readInt(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;
  var cursorEnd = cursor + 3 * count;
  if (cursorEnd > buffer.length) return null;

  var array = [];
  for (var i = 0; i < count; ++i) {
    array.push({
      x: buffer.readInt8(cursor),
      y: buffer.readInt8(cursor + 1),
      z: buffer.readInt8(cursor + 2),
    });
    cursor += 3;
  }
  return {
    value: array,
    size: cursorEnd - offset,
  };
}

function readByteVector(buffer, offset) {
  if (offset + 3 > buffer.length) return null;
  return {
    value: {
      x: buffer.readInt8(offset),
      y: buffer.readInt8(offset + 1),
      z: buffer.readInt8(offset + 2),
    },
    size: 3,
  };
}

function readIntVector(buffer, offset) {
  if (offset + 12 > buffer.length) return null;
  return {
    value: {
      x: buffer.readInt32BE(offset),
      y: buffer.readInt32BE(offset + 4),
      z: buffer.readInt32BE(offset + 8),
    },
    size: 12,
  };
}

function readEntityMetadata(buffer, offset) {
  var cursor = offset;
  var metadata = [];
  var item, key, type, results, reader, typeName, dataType;
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    item = buffer.readUInt8(cursor);
    cursor += 1;
    if (item === 0x7f) {
      return {
        value: metadata,
        size: cursor - offset,
      };
    }
    key = item & 0x1f;
    type = item >> 5;
    typeName = entityMetadataTypes[type];
    dataType = types[typeName];
    if (!dataType) {
      return {
        error: new Error("unrecognized entity metadata type " + type)
      }
    }
    reader = dataType[0];
    if (!reader) {
      return {
        error: new Error("missing reader for entity metadata type " + type)
      }
    }
    results = reader(buffer, cursor);
    if (! results) return null;
    metadata.push({
      key: key,
      value: results.value,
      type: typeName,
    });
    cursor += results.size;
  }
}

function readObjectData(buffer, offset) {
  var cursor = offset + 4;
  if (cursor > buffer.length) return null;
  var intField = buffer.readInt32BE(offset);

  if (intField === 0) {
    return {
      value: {
        intField: intField,
      },
      size: cursor - offset,
    };
  }

  if (cursor + 6 > buffer.length) return null;
  var velocityX = buffer.readInt16BE(cursor);
  cursor += 2;
  var velocityY = buffer.readInt16BE(cursor);
  cursor += 2;
  var velocityZ = buffer.readInt16BE(cursor);
  cursor += 2;

  return {
    value: {
      intField: intField,
      velocityX: velocityX,
      velocityY: velocityY,
      velocityZ: velocityZ,
    },
    size: cursor - offset,
  };
}

function readMapChunkBulk (buffer, offset) {
  var cursor = offset + 7;
  if (cursor > buffer.length) return null;
  var chunkColumnCount = buffer.readInt16BE(offset);
  var dataSize = buffer.readInt32BE(offset + 2);
  var skyLightSent = !!buffer.readInt8(offset + 6);

  var cursorEnd = cursor + dataSize + 12 * chunkColumnCount;
  if (cursorEnd > buffer.length) return null;

  var compressedChunkDataEnd = cursor + dataSize;
  var compressedChunkData = buffer.slice(cursor, compressedChunkDataEnd);
  cursor = compressedChunkDataEnd;

  var meta = [];
  var i, chunkX, chunkZ, bitMap, addBitMap;
  for (i = 0; i < chunkColumnCount; ++i) {
    chunkX = buffer.readInt32BE(cursor);
    cursor += 4;
    chunkZ = buffer.readInt32BE(cursor);
    cursor += 4;
    bitMap = buffer.readUInt16BE(cursor);
    cursor += 2;
    addBitMap = buffer.readUInt16BE(cursor);
    cursor += 2;

    meta.push({
      x: chunkX,
      z: chunkZ,
      bitMap: bitMap,
      addBitMap: addBitMap,
    });
  }

  if (chunkColumnCount !== meta.length) {
    return {
      error: new Error("ChunkColumnCount different from length of meta")
    }
  }

  return {
    value: {
      skyLightSent: skyLightSent,
      compressedChunkData: compressedChunkData,
      meta: meta,
    },
    size: cursorEnd - offset,
  };
}

function readAscii (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;

  var strBegin = offset + results.size;
  var strLen = results.value;
  var strEnd = strBegin + strLen;
  if (strEnd > buffer.length) return null;
  var str = buffer.slice(strBegin, strEnd).toString('ascii');

  return {
    value: str,
    size: strEnd - offset,
  };
}

function readString (buffer, offset) {
  var cursor = offset + 2;
  if (cursor > buffer.length) return null;
  var stringLength = buffer.readInt16BE(offset);
  var strEnd = cursor + stringLength * 2;
  if (strEnd > buffer.length) return null;

  var value = '';
  for (var i = 0; i < stringLength; ++i) {
    value += String.fromCharCode(buffer.readUInt16BE(cursor));
    cursor += 2;
  }
  return {
    value: value,
    size: cursor - offset,
  };
}

function readByteArray16 (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;

  var bytesBegin = offset + results.size;
  var bytesSize = results.value;
  var bytesEnd = bytesBegin + bytesSize;
  if (bytesEnd > buffer.length) return null;
  var bytes = buffer.slice(bytesBegin, bytesEnd);

  return {
    value: bytes,
    size: bytesEnd - offset,
  };
}

function readByteArray32(buffer, offset) {
  var results = readInt(buffer, offset);
  if (! results) return null;

  var bytesBegin = offset + results.size;
  var bytesSize = results.value;
  var bytesEnd = bytesBegin + bytesSize;
  if (bytesEnd > buffer.length) return null;
  var bytes = buffer.slice(bytesBegin, bytesEnd);

  return {
    value: bytes,
    size: bytesEnd - offset,
  };
}

function readSlotArray (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var slotArray = [];
  for (var i = 0; i < count; ++i) {
    results = readSlot(buffer, cursor);
    if (! results) return null;
    slotArray.push(results.value);
    cursor += results.size;
  }

  return {
    value: slotArray,
    size: cursor - offset,
  };
}

function readShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readUShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readUInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readInt(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readInt32BE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readFloat(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readFloatBE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readDouble(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  var value = buffer.readDoubleBE(offset);
  return {
    value: value,
    size: 8,
  };
}

function readLong(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  return {
    value: [buffer.readInt32BE(offset), buffer.readInt32BE(offset + 4)],
    size: 8,
  };
}

function readByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readUByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readUInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readBool(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: !!value,
    size: 1,
  };
}

function readSlot(buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var blockId = results.value;
  var cursor = offset + results.size;

  if (blockId === -1) {
    return {
      value: { id: blockId },
      size: cursor - offset,
    };
  }

  var cursorEnd = cursor + 5;
  if (cursorEnd > buffer.length) return null;
  var itemCount = buffer.readInt8(cursor);
  var itemDamage = buffer.readInt16BE(cursor + 1);
  var nbtDataSize = buffer.readInt16BE(cursor + 3);
  if (nbtDataSize === -1) nbtDataSize = 0;
  var nbtDataEnd = cursorEnd + nbtDataSize;
  var nbtData = buffer.slice(cursorEnd, nbtDataEnd);

  return {
    value: {
      id: blockId,
      itemCount: itemCount,
      itemDamage: itemDamage,
      nbtData: nbtData,
    },
    size: nbtDataEnd - offset,
  };
}

function SlotWriter(value) {
  this.value = value;
  this.size = value.id === -1 ? 2 : 7 + this.value.nbtData.length;
}

SlotWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.id, offset);
  if (this.value.id === -1) return;
  buffer.writeInt8(this.value.itemCount, offset + 2);
  buffer.writeInt16BE(this.value.itemDamage, offset + 3);
  var nbtDataSize = this.value.nbtData.length;
  if (nbtDataSize === 0) nbtDataSize = -1; // I don't know wtf mojang smokes
  buffer.writeInt16BE(nbtDataSize, offset + 5);
  this.value.nbtData.copy(buffer, offset + 7);
};

function StringWriter(value) {
  assert.ok(value.length < STRING_MAX_LENGTH, "string greater than max length");
  this.value = value;
  this.size = 2 + 2 * value.length;
}

StringWriter.prototype.write = function(buffer, offset) {
  var cursor = offset;
  buffer.writeInt16BE(this.value.length, cursor);
  cursor += 2;

  for (var i = 0; i < this.value.length; ++i) {
    buffer.writeUInt16BE(this.value.charCodeAt(i), cursor);
    cursor += 2;
  }
};

function AsciiWriter(value) {
  this.value = value;
  this.size = 2 + value.length;
}

AsciiWriter.prototype.write = function(buffer, offset) {
  var cursor = offset;
  buffer.writeInt16BE(this.value.length, cursor);
  cursor += 2;

  for (var i = 0; i < this.value.length; ++i) {
    buffer.writeUInt8(this.value.charCodeAt(i), cursor);
    cursor += 1;
  }
};

function ByteArray16Writer(value) {
  assert.ok(Buffer.isBuffer(value), "non buffer passed to ByteArray16Writer");
  this.value = value;
  this.size = 2 + value.length;
}

ByteArray16Writer.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  this.value.copy(buffer, offset + 2);
};

function ByteWriter(value) {
  this.value = value == null ? 0 : value;
  this.size = 1;
}

ByteWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value, offset);
}

function BoolWriter(value) {
  this.value = value;
  this.size = 1;
}

BoolWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value ? 1 : 0, offset);
}

function UByteWriter(value) {
  this.value = value;
  this.size = 1;
}

UByteWriter.prototype.write = function(buffer, offset) {
  buffer.writeUInt8(this.value, offset);
};

function FloatWriter(value) {
  this.value = value;
  this.size = 4;
}

FloatWriter.prototype.write = function(buffer, offset) {
  buffer.writeFloatBE(this.value, offset);
}

function DoubleWriter(value) {
  this.value = value;
  this.size = 8;
}

DoubleWriter.prototype.write = function(buffer, offset) {
  buffer.writeDoubleBE(this.value, offset);
}

function ShortWriter(value) {
  this.value = value;
  this.size = 2;
}

ShortWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value, offset);
}

function UShortWriter(value) {
  this.value = value;
  this.size = 2;
}

UShortWriter.prototype.write = function(buffer, offset) {
  buffer.writeUInt16BE(this.value, offset);
}

function IntWriter(value) {
  this.value = value;
  this.size = 4;
}

IntWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value, offset);
}

function LongWriter(value) {
  this.value = value;
  this.size = 8;
}

LongWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value[0], offset);
  buffer.writeInt32BE(this.value[1], offset + 4);
}

function get(packetId, toServer) {
  var packetInfo = packets[packetId];
  if (!packetInfo) {
    return null;
  }
  return Array.isArray(packetInfo) ?
    packetInfo :
    toServer ?
      packetInfo.toServer :
      packetInfo.toClient;
}

function createPacketBuffer(packetId, params, isServer) {
  var size = 1;
  var fields = [ new UByteWriter(packetId) ];
  var packet = get(packetId, !isServer);
  assert.notEqual(packet, null);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    var Writer = types[fieldInfo.type][1];
    assert.ok(Writer, "missing writer for data type: " + fieldInfo.type);
    var field = new Writer(value);
    size += field.size;
    fields.push(field);
  });
  var buffer = new Buffer(size);
  var cursor = 0;
  fields.forEach(function(field) {
    field.write(buffer, cursor);
    cursor += field.size;
  });
  return buffer;
}

function parsePacket(buffer, isServer) {
  if (buffer.length < 1) return null;
  var packetId = buffer.readUInt8(0);
  var size = 1;
  var results = { id: packetId };
  var packetInfo = get(packetId, isServer);
  if (packetInfo == null) {
    return {
      error: new Error("Unrecognized packetId: " + packetId)
    }
  }
  var i, fieldInfo, read, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    read = types[fieldInfo.type][0];
    if (!read) {
      return {
        error: new Error("missing reader for data type: " + fieldInfo.type)
      }
    }
    readResults = read(buffer, size);
    if (readResults) {
      // if readResults.error is undef, error stays undef'd
      if (readResults.error) {
        return {
          error: readResults.error
        }
      }
      results[fieldInfo.name] = readResults.value;
      size += readResults.size;
    } else {
      // buffer needs to be more full
      return null;
    }
  }
  return {
    size: size,
    results: results,
  };
}

module.exports = {
  version: 51,
  minecraftVersion: '1.4.7',
  sessionVersion: 13,
  parsePacket: parsePacket,
  createPacketBuffer: createPacketBuffer,
  STRING_MAX_LENGTH: STRING_MAX_LENGTH,
  packets: packets,
  get: get,
};
