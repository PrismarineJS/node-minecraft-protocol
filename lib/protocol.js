var Iconv = require('iconv').Iconv
  , assert = require('assert')
  , toUcs2 = new Iconv('UTF-8', 'utf16be')
  , fromUcs2 = new Iconv('utf16be', 'UTF-8')

var STRING_MAX_LENGTH = 240;

exports.version = 51;
exports.sessionVersion = 13;
exports.parsePacket = parsePacket;
exports.createPacketBuffer = createPacketBuffer;

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
    { name: "y", type: "byte" },
    { name: "z", type: "int" },
    { name: "face", type: "byte" }
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
    { name: "y", type: "byte" },
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
    { name: "compressedData", type: "byteArray32" }
  ],
  0x34: [
    { name: "chunkX", type: "int" },
    { name: "chunkZ", type: "int" },
    { name: "recordCount", type: "short" },
    { name: "data", type: "byteArray32" }
  ],
  0x35: [
    { name: "x", type: "int" },
    { name: "y", type: "byte" },
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
    { name: "y", type: "byte" },
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

function get(packetId, toServer) {
  var packetInfo = packets[packetId];
  return Array.isArray(packetInfo) ?
    packetInfo :
    toServer ?
      packetInfo.toServer :
      packetInfo.toClient;
}

var writers = {
  'int': IntWriter,
  'short': ShortWriter,
  'byte': ByteWriter,
  'ubyte': UByteWriter,
  'string': StringWriter,
  'byteArray16': ByteArray16Writer,
  'bool': BoolWriter,
  'double': DoubleWriter,
  'float': FloatWriter,
  'slot': SlotWriter,
};

var readers = {
  'string': readString,
  'ascii': readAscii,
  'byteArray16': readByteArray16,
  'byteArray32': readByteArray32,
  'short': readShort,
  'ushort': readUShort,
  'int': readInt,
  'byte': readByte,
  'ubyte': readUByte,
  'long': readLong,
  'slot': readSlot,
  'bool': readBool,
  'double': readDouble,
  'float': readFloat,
  'slotArray': readSlotArray,
  'mapChunkBulk': readMapChunkBulk,
  'entityMetadata': readEntityMetadata,
  'objectData': readObjectData,
  'intArray8': readIntArray8,
  'intVector': readIntVector,
  'byteVector': readByteVector,
  'byteVectorArray': readByteVectorArray,
};

var entityMetadataReaders = {
  0: readByte,
  1: readShort,
  2: readInt,
  3: readFloat,
  4: readString,
  5: readSlot,
  6: readIntVector,
};

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
  var metadata = {};
  var item, key, type, results, reader;
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    item = buffer.readUInt8(cursor);
    cursor += 1;
    if (item === 0x7f) break;
    key = item & 0x1f;
    type = item >> 5;
    reader = entityMetadataReaders[type];
    assert.ok(reader, "missing reader for entity metadata type " + type);
    results = reader(buffer, cursor);
    if (! results) return null;
    metadata[key] = results.value;
    cursor += results.size;
  }
  return {
    value: metadata,
    size: cursor - offset,
  };
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
  var chunkCount = buffer.readInt16BE(offset);
  var dataSize = buffer.readInt32BE(offset + 2);
  var skyLightSent = !!buffer.readInt8(offset + 6);

  var cursorEnd = cursor + dataSize + 12 * chunkCount;
  if (cursorEnd > buffer.length) return null;

  var compressedChunkDataEnd = cursor + dataSize;
  var compressedChunkData = buffer.slice(cursor, compressedChunkDataEnd);
  cursor = compressedChunkDataEnd;

  var meta = [];
  var i, chunkX, chunkZ, primaryBitMap, addBitMap;
  for (i = 0; i < chunkCount; ++i) {
    chunkX = buffer.readInt32BE(cursor);
    cursor += 4;
    chunkZ = buffer.readInt32BE(cursor);
    cursor += 4;
    primaryBitMap = buffer.readUInt16BE(cursor);
    cursor += 2;
    addBitMap = buffer.readUInt16BE(cursor);
    cursor += 2;

    meta.push({
      chunkX: chunkX,
      chunkZ: chunkZ,
      primaryBitMap: primaryBitMap,
      addBitMap: addBitMap,
    });
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
  var results = readShort(buffer, offset);
  if (! results) return null;
  
  var strBegin = offset + results.size;
  var strLen = results.value;
  var strEnd = strBegin + strLen * 2;
  if (strEnd > buffer.length) return null;
  var str = fromUcs2.convert(buffer.slice(strBegin, strEnd)).toString('utf8');

  return {
    value: str,
    size: strEnd - offset,
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
  this.value = value;
  this.encoded = toUcs2.convert(value);
  this.size = 2 + this.encoded.length;
}

StringWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  this.encoded.copy(buffer, offset + 2);
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
  this.value = value;
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

function IntWriter(value) {
  this.value = value;
  this.size = 4;
}

IntWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value, offset);
}

function createPacketBuffer(packetId, params) {
  var size = 1;
  var fields = [ new UByteWriter(packetId) ];
  var packet = get(packetId);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    var Writer = writers[fieldInfo.type];
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

function parsePacket(buffer) {
  if (buffer.length < 1) return null;
  var packetId = buffer.readUInt8(0);
  var size = 1;
  var results = { id: packetId };
  var packetInfo = get(packetId);
  assert.ok(packetInfo, "Unrecognized packetId: " + packetId);
  var i, fieldInfo, read, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    read = readers[fieldInfo.type];
    assert.ok(read, "missing reader for data type: " + fieldInfo.type);
    readResults = read(buffer, size);
    if (readResults) {
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
