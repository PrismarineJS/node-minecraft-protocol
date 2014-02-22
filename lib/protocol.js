var assert = require('assert');
var util = require('util');

var STRING_MAX_LENGTH = 240;
var SRV_STRING_MAX_LENGTH = 32767;

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
}

var packets = {
  "handshaking": {
    "toServer": {
      0x00: [
        { name: "protocolVersion", type: "varint" },
        { name: "serverHost", type: "string" },
        { name: "serverPort", type: "ushort" },
        { name: "nextState", type: "varint" }
      ]
    }
  },
  "status": {
    "toClient": {
      0x00: [
        { name: "response", type: "string" }
      ],
      0x01: [
        { name: "time", type: "long" }
      ]
    },
    "toServer": {
      0x00: [],
      0x01: [
        { name: "time", type: "long" }
      ]
    }
  },
  "login": {
    "toClient": {
      0x00: [
        { name: "reason", type: "string" }
      ],
      0x01: [
        { name: "serverId", type: "string" },
        { name: "publicKey", type: "byteArray16" },
        { name: "verifyToken", type: "byteArray16" }
      ],
      0x02: [
        { name: "uuid", type: "string" },
        { name: "username", type: "string" }
      ]
    },
    "toServer": {
      0x00: [
        { name: "username", type: "string" }
      ],
      0x01: [
        { name: "sharedSecret", type: "byteArray16" },
        { name: "verifyToken", type: "byteArray16" }
      ]
    }
  },
  "play": {
    "toClient": {
      0x00: [
        { name: "keepAliveId", type: "int" },
      ],
      0x01: [
        { name: "entityId", type: "int" },
        { name: "gameMode", type: "ubyte" },
        { name: "dimension", type: "byte" },
        { name: "difficulty", type: "ubyte" },
        { name: "maxPlayers", type: "ubyte" },
        { name: "levelType", type: "string" },
      ],
      0x02: [
        { name: "message", type: "ustring" },
      ],
      0x03: [
        { name: "age", type: "long" },
        { name: "time", type: "long" },
      ],
      0x04: [
        { name: "entityId", type: "int" },
        { name: "slot", type: "short" },
      ],
      0x05: [
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ],
      0x06: [
        { name: "health", type: "float" },
        { name: "food", type: "short" },
        { name: "foodSaturation", type: "float" }
      ],
      0x07: [
        { name: "dimension", type: "int" },
        { name: "difficulty", type: "ubyte" },
        { name: "gamemode", type: "ubyte" },
        { name: "levelType", type: "string" }
      ],
      0x08: [
        { name: "x", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ],
      0x09: [
        { name: "slot", type: "byte" }
      ],
      0x0A: [
        { name: "entityId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" }
      ],
      0x0B: [
        { name: "entityId", type: "varint" },
        { name: "animation", type: "byte" }
      ],
      0x0C: [
        { name: "entityId", type: "varint" },
        { name: "playerUUID", type: "string" },
        { name: "playerName", type: "string" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" },
        { name: "currentItem", type: "short" },
        { name: "metadata", type: "entityMetadata" }
      ],
      0x0D: [
        { name: "collectedEntityId", type: "int" },
        { name: "collectorEntityId", type: "int" }
      ],
      0x0E: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "pitch", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "objectData", type: "objectData" } 
      ],
      0x0F: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "ubyte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "pitch", type: "byte" },
        { name: "headPitch", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "velocityX", type: "short" },
        { name: "velocityY", type: "short" },
        { name: "velocityZ", type: "short" },
        { name: "metadata", type: "entityMetadata" },
      ],
      0x10: [
        { name: "entityId", type: "varint" },
        { name: "title", type: "string" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "direction", type: "int" }
      ],
      0x11: [
        { name: "entityId", type: "varint" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "count", type: "short" }
      ],
      0x12: [
        { name: "entityId", type: "int" },
        { name: "velocityX", type: "short" },
        { name: "velocityY", type: "short" },
        { name: "velocityZ", type: "short" }
      ],
      0x13: [
        { name: "entityIds", type: "intArray8" }
      ],
      0x14: [
        { name: "entityId", type: "int" } 
      ],
      0x15: [
        { name: "entityId", type: "int" },
        { name: "dX", type: "byte" },
        { name: "dY", type: "byte" },
        { name: "dZ", type: "byte" }
      ],
      0x16: [
        { name: "entityId", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ],
      0x17: [
        { name: "entityId", type: "int" },
        { name: "dX", type: "byte" },
        { name: "dY", type: "byte" },
        { name: "dZ", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ],
      0x18: [
        { name: "entityId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ],
      0x19: [
        { name: "entityId", type: "int" },
        { name: "headYaw", type: "byte" },
      ],
      0x1A: [
        { name: "entityId", type: "int" },
        { name: "entityStatus", type: "byte" }
      ],
      0x1B: [
        { name: "entityId", type: "int" },
        { name: "vehicleId", type: "int" },
        { name: "leash", type: "bool" }
      ],
      0x1C: [
        { name: "entityId", type: "int" },
        { name: "metadata", type: "entityMetadata" }
      ],
      0x1D: [
        { name: "entityId", type: "int" },
        { name: "effectId", type: "byte" },
        { name: "amplifier", type: "byte" },
        { name: "duration", type: "short" }
      ],
      0x1E: [
        { name: "entityId", type: "int" },
        { name: "effectId", type: "byte" }
      ],
      0x1F: [
        { name: "experienceBar", type: "float" },
        { name: "level", type: "short" },
        { name: "totalExperience", type: "short" }
      ],
      0x20: [
        { name: "entityId", type: "int" },
        { name: "properties", type: "propertyArray" }
      ],
      0x21: [
        { name: "x", type: "int" },
        { name: "z", type: "int" },
        { name: "groundUp", type: "bool" },
        { name: "bitMap", type: "ushort" },
        { name: "addBitMap", type: "ushort" },
        { name: "compressedChunkData", type: "byteArray32" }
      ],
      0x22: [
        { name: "chunkX", type: "int" },
        { name: "chunkZ", type: "int" },
        { name: "recordCount", type: "short" },
        { name: "data", type: "byteArray32" }
      ],
      0x23: [
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "type", type: "varint" },
        { name: "metadata", type: "ubyte" }
      ],
      0x24: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "byte1", type: "ubyte" },
        { name: "byte2", type: "ubyte" },
        { name: "blockId", type: "varint" }
      ],
      0x25: [
        { name: "entityId", type: "varint" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "destroyStage", type: "byte" }
      ],
      0x26: [
        { name: "data", type: "mapChunkBulk" }
      ],
      0x27: [
        { name: "x", type: "float" },
        { name: "y", type: "float" },
        { name: "z", type: "float" },
        { name: "radius", type: "float" },
        { name: "affectedBlockOffsets", type: "byteVectorArray" },
        { name: "playerMotionX", type: "float" },
        { name: "playerMotionY", type: "float" },
        { name: "playerMotionZ", type: "float" }
      ],
      0x28: [
        { name: "effectId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "byte" },
        { name: "z", type: "int" },
        { name: "data", type: "int" },
        { name: "global", type: "bool" }
      ],
      0x29: [
        { name: "soundName", type: "string" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "volume", type: "float" },
        { name: "pitch", type: "ubyte" }
      ],
      0x2A: [
        { name: "particleName", type: "string" },
        { name: "x", type: "float" },
        { name: "y", type: "float" },
        { name: "z", type: "float" },
        { name: "offsetX", type: "float" },
        { name: "offsetY", type: "float" },
        { name: "offsetZ", type: "float" },
        { name: "particleSpeed", type: "float" },
        { name: "particles", type: "int" }
      ],
      0x2B: [
        { name: "reason", type: "ubyte" },
        { name: "gameMode", type: "float" }
      ],
      0x2C: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ],
      0x2D: [
        { name: "windowId", type: "ubyte" },
        { name: "inventoryType", type: "ubyte" },
        { name: "windowTitle", type: "string" },
        { name: "slotCount", type: "ubyte" },
        { name: "useProvidedTitle", type: "bool" },
        { name: "entityId", type: "int", condition: function(field_values) {
          return field_values['inventoryType'] == 11;
        } }
      ],
      0x2E: [
        { name: "windowId", type: "ubyte" }
      ],
      0x2F: [
        { name: "windowId", type: "ubyte" },
        { name: "slot", type: "short" },
        { name: "item", type: "slot" }
      ],
      0x30: [
        { name: "windowId", type: "ubyte" },
        { name: "items", type: "slotArray" }
      ],
      0x31: [
        { name: "windowId", type: "ubyte" },
        { name: "property", type: "short" },
        { name: "value", type: "short" }
      ],
      0x32: [
        { name: "windowId", type: "ubyte" },
        { name: "action", type: "short" },
        { name: "accepted", type: "bool" }
      ],
      0x33: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "text1", type: "string" },
        { name: "text2", type: "string" },
        { name: "text3", type: "string" },
        { name: "text4", type: "string" }
      ],
      0x34: [
        { name: "itemDamage", type: "varint" },
        { name: "data", type: "byteArray16" },
      ],
      0x35: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "action", type: "ubyte" },
        { name: "nbtData", type: "byteArray16" }
      ],
      0x36: [
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ],
      0x37: [
        { name: "count", type: "statisticArray" }
      ],
      0x38: [
        { name: "playerName", type: "string" },
        { name: "online", type: "bool" },
        { name: "ping", type: "short" }
      ],
      0x39: [
        { name: "flags", type: "byte" },
        { name: "flyingSpeed", type: "float" },
        { name: "walkingSpeed", type: "float" }
      ],
      0x3A: [
        { name: "matches", type: "matchArray" }
      ],
      0x3B: [
        { name: "name", type: "string" },
        { name: "displayText", type: "string" },
        { name: "action", type: "byte" }
      ],
      0x3C: [
        { name: "itemName", type: "string" },
        { name: "remove", type: "bool" },
        { name: "scoreName", type: "string", condition: function(field_values) {
          return !field_values['remove']
        } },
        { name: "value", type: "int", condition: function(field_values) {
          return !field_values['remove']
        } }
      ],
      0x3D: [
        { name: "position", type: "byte" },
        { name: "name", type: "string" }
      ],
      0x3E: [
        { name: "team", type: "string" },
        { name: "mode", type: "byte" },
        { name: "name", type: "string", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "prefix", type: "string", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "suffix", type: "string", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "friendlyFire", type: "byte", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "players", type: "stringArray", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 3 || field_values['mode'] == 4;
        } }
      ],
      0x3F: [
        { name: "channel", type: "string" },
        { name: "data", type: "byteArray16" }
      ],
      0x40: [
        { name: "reason", type: "string" }
      ]
    },
    "toServer": {
      0x00: [
        { name: "keepAliveId", type: "int" }
      ],
      0x01: [
        { name: "message", type: "string" }
      ],
      0x02: [
        { name: "target", type: "int" },
        { name: "mouse", type: "byte" }
      ],
      0x03: [
        { name: "onGround", type: "bool" }
      ],
      0x04: [
        { name: "x", type: "double" },
        { name: "stance", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "onGround", type: "bool" }
      ],
      0x05: [
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ],
      0x06: [
        { name: "x", type: "double" },
        { name: "stance", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ],
      0x07: [
        { name: "status", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "face", type: "byte" }
      ],
      0x08: [
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "direction", type: "byte" },
        { name: "heldItem", type: "slot" },
        { name: "cursorX", type: "byte" },
        { name: "cursorY", type: "byte" },
        { name: "cursorZ", type: "byte" }
      ],
      0x09: [
        { name: "slotId", type: "short" }
      ],
      0x0A: [
        { name: "entityId", type: "int" },
        { name: "animation", type: "byte" }
      ],
      0x0B: [
        { name: "entityId", type: "int" },
        { name: "actionId", type: "byte" },
        { name: "jumpBoost", type: "int" }
      ],
      0x0C: [
        { name: "sideways", type: "float" },
        { name: "forward", type: "float" },
        { name: "jump", type: "bool" },
        { name: "unmount", type: "bool" }
      ],
      0x0D: [
        { name: "windowId", type: "byte" }
      ],
      0x0E: [
        { name: "windowId", type: "byte" },
        { name: "slot", type: "short" },
        { name: "mouseButton", type: "byte" },
        { name: "action", type: "short" },
        { name: "mode", type: "byte" },
        { name: "item", type: "slot" }
      ],
      0x0F: [
        { name: "windowId", type: "byte" },
        { name: "action", type: "short" },
        { name: "accepted", type: "bool" }
      ],
      0x10: [
        { name: "slot", type: "short" },
        { name: "item", type: "slot" }
      ],
      0x11: [
        { name: "windowId", type: "byte" },
        { name: "enchantment", type: "byte" }
      ],
      0x12: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "text1", type: "string" },
        { name: "text2", type: "string" },
        { name: "text3", type: "string" },
        { name: "text4", type: "string" }
      ],
      0x13: [
        { name: "flags", type: "byte" },
        { name: "flyingSpeed", type: "float" },
        { name: "walkingSpeed", type: "float" }
      ],
      0x14: [
        { name: "text", type: "string" }
      ],
      0x15: [
        { name: "locale", type: "string" },
        { name: "viewDistance", type: "byte" },
        { name: "chatFlags", type: "byte" },
        { name: "chatColors", type: "bool" },
        { name: "difficulty", type: "byte" },
        { name: "showCape", type: "bool" }
      ],
      0x16: [
        { name: "payload", type: "byte" }
      ],
      0x17: [
        { name: "channel", type: "string" },
        { name: "data", type: "byteArray16" }
      ],
    }
  }
};

var types = {
  'int': [readInt, writeInt, 4],
  'short': [readShort, writeShort, 2],
  'ushort': [readUShort, writeUShort, 2],
  'byte': [readByte, writeByte, 1],
  'ubyte': [readUByte, writeUByte, 1],
  'string': [readString, writeString, sizeOfString],
  'ustring': [readString, writeString, sizeOfUString],
  'byteArray16': [readByteArray16, writeByteArray16, sizeOfByteArray16],
  'bool': [readBool, writeBool, 1],
  'double': [readDouble, writeDouble, 8],
  'float': [readFloat, writeFloat, 4],
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'long': [readLong, writeLong, 8],
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'ascii': [readAscii, writeAscii, sizeOfAscii],
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
  'byteArray32': [readByteArray32, writeByteArray32, sizeOfByteArray32],
  'slotArray': [readSlotArray, writeSlotArray, sizeOfSlotArray],
  'mapChunkBulk': [readMapChunkBulk, writeMapChunkBulk, sizeOfMapChunkBulk],
  'objectData': [readObjectData, writeObjectData, sizeOfObjectData],
  'intArray8': [readIntArray8, writeIntArray8, sizeOfIntArray8],
  'intVector': [readIntVector, writeIntVector, 12],
  'byteVector': [readByteVector, writeByteVector, 3],
  'byteVectorArray': [readByteVectorArray, writeByteVectorArray, sizeOfByteVectorArray],
  'stringArray': [readStringArray, writeStringArray, sizeOfStringArray],
  'UUID': [readUUID, writeUUID, 16],
  'propertyArray': [readPropertyArray, writePropertyArray, sizeOfPropertyArray],
  'statisticArray': [readStatisticArray, writeStatisticArray, sizeOfStatisticArray],
  'matchArray': [readMatchArray, writeMatchArray, sizeOfMatchArray]
};

var debug;
if (process.env.NODE_DEBUG && /(minecraft-protocol|mc-proto)/.test(process.env.NODE_DEBUG)) {
  var pid = process.pid;
  debug = function(x) {
    // if console is not set up yet, then skip this.
    if (!console.error)
      return;
    console.error('MC-PROTO: %d', pid,
                  util.format.apply(util, arguments).slice(0, 500));
  };
} else {
  debug = function() { };
}

function sizeOfByteArray32(value) {
  return 4 + value.length;
}

function writeByteArray32(value, buffer, offset) {
  buffer.writeInt32BE(value.length, offset);
  value.copy(buffer, offset + 4);
  return offset + 4 + value.length;
}

function sizeOfSlotArray(value) {
  var size = 2;
  for (var i = 0; i < value.length; ++i) {
    size += sizeOfSlot(value[i]);
  }
  return size;
}

function writeSlotArray(value, buffer, offset) {
  buffer.writeInt16BE(value.length, offset);
  offset += 2;
  value.forEach(function(slot) {
    offset = writeSlot(slot, buffer, offset);
  });
  return offset;
}

var entityMetadataTypes = {
  0: 'byte',
  1: 'short',
  2: 'int',
  3: 'float',
  4: 'string',
  5: 'slot',
  6: 'intVector'
};

// maps string type name to number
var entityMetadataTypeBytes = {};
for (var n in entityMetadataTypes) {
  if (!entityMetadataTypes.hasOwnProperty(n)) continue;

  entityMetadataTypeBytes[entityMetadataTypes[n]] = n;
}

function sizeOfEntityMetadata(value) {
  var size = 1 + value.length;
  var item;
  for (var i = 0; i < value.length; ++i) {
    item = value[i];
    size += sizeOf(item.type, item.value);
  }
  return size;
}

function writeEntityMetadata(value, buffer, offset) {
  value.forEach(function(item) {
    var type = entityMetadataTypeBytes[item.type];
    var headerByte = (type << 5) | item.key;
    buffer.writeUInt8(headerByte, offset);
    offset += 1;
    offset = types[item.type][1](item.value, buffer, offset);
  });
  buffer.writeUInt8(0x7f, offset);
  return offset + 1;
}

function sizeOfObjectData(value) {
  return value.intField === 0 ? 4 : 10;
}

function writeObjectData(value, buffer, offset) {
  buffer.writeInt32BE(value.intField, offset);
  if (value.intField === 0) return -1;
  offset += 4;

  buffer.writeInt16BE(value.velocityX, offset);
  offset += 2;
  buffer.writeInt16BE(value.velocityY, offset);
  offset += 2;
  buffer.writeInt16BE(value.velocityZ, offset);
  return offset + 2;
}

function sizeOfMapChunkBulk(value) {
  return 7 + value.compressedChunkData.length + 12 * value.meta.length;
}

function writeMapChunkBulk(value, buffer, offset) {
  buffer.writeInt16BE(value.meta.length, offset);
  offset += 2;
  buffer.writeInt32BE(value.compressedChunkData.length, offset);
  offset += 4;
  buffer.writeInt8(+value.skyLightSent, offset);
  offset += 1;

  value.compressedChunkData.copy(buffer, offset);
  offset += value.compressedChunkData.length;

  var meta;
  for (var i = 0; i < value.meta.length; ++i) {
    meta = value.meta[i];
    buffer.writeInt32BE(meta.x, offset);
    offset += 4;
    buffer.writeInt32BE(meta.z, offset);
    offset += 4;
    buffer.writeUInt16BE(meta.bitMap, offset);
    offset += 2;
    buffer.writeUInt16BE(meta.addBitMap, offset);
    offset += 2;
  }
  return offset;
}

function sizeOfIntArray8(value) {
  return 1 + 4 * value.length;
}

function writeIntArray8(value, buffer, offset) {
  buffer.writeInt8(value.length, offset);
  offset += 1;

  value.forEach(function(item) {
    buffer.writeInt32BE(item, offset);
    offset += 4;
  });
  return offset;
}

function writeIntVector(value, buffer, offset) {
  buffer.writeInt32BE(value.x, offset);
  buffer.writeInt32BE(value.y, offset + 4);
  buffer.writeInt32BE(value.z, offset + 8);
  return offset + 12;
}

function writeByteVector(value, buffer, offset) {
  buffer.writeInt8(value.x, offset);
  buffer.writeInt8(value.y, offset + 1);
  buffer.writeInt8(value.z, offset + 2);
  return offset + 3;
}

function sizeOfByteVectorArray(value) {
  return 4 + 3 * value.length;
}

function writeByteVectorArray(value, buffer, offset) {
  buffer.writeInt32BE(value.length, offset);
  offset += 4;
  value.forEach(function(vec) {
    buffer.writeInt8(vec.x, offset);
    offset += 1;
    buffer.writeInt8(vec.y, offset);
    offset += 1;
    buffer.writeInt8(vec.z, offset);
    offset += 1;
  });
  return offset;
}

function sizeOfStringArray(value) {
  var size = 2;
  for (var i = 0; i < value.length; ++i) {
    size += sizeOfString(value[i]);
  }
  return size;
}

function writeStringArray(value, buffer, offset) {
  buffer.writeInt16BE(value.length, offset);
  offset += 2;
  value.forEach(function(string) {
    offset = writeString(string, buffer, offset);
  });
  return offset;
}

function sizeOfPropertyArray(value) {
  var size = 4;
  for (var i = 0; i < value.length; ++i) {
    size += sizeOfString(value[i].key) + types['double'][2] + types['short'][2];
    for (var j = 0; j < value[i].elementList.length; j++) {
      size += types['UUID'][2] + types['double'][2] + types['byte'][2];
    }
  }
  return size;
}

function writeUUID(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  buffer.writeInt32BE(value[2], offset + 8);
  buffer.writeInt32BE(value[3], offset + 12);
  return offset + 16;
}

function writePropertyArray(value, buffer, offset) {
  buffer.writeInt32BE(value.length, offset);
  offset += 4;
  for (var i = 0; i < value.length; ++i) {
    offset = writeString(value[i].key, buffer, offset);
    offset = writeDouble(value[i].value, buffer, offset);
    offset = writeShort(value[i].elementList.length, buffer, offset);
    for (var j = 0; j < value[i].elementList.length; j++) {
      offset = writeUUID(value[i].elementList[j].uuid, buffer, offset);
      offset = writeDouble(value[i].elementList[j].amount, buffer, offset);
      offset = writeByte(value[i].elementList[j].operation, buffer, offset);
    }
  }
  return offset;
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
    debug("Reading entity metadata type " + type + " (" + ( typeName || "unknown" ) + ")");
    if (!typeName) {
      return {
        error: new Error("unrecognized entity metadata type " + type)
      }
    }
    dataType = types[typeName];
    if (!dataType) {
      return {
        error: new Error("unrecognized entity metadata type name " + typeName)
      }
    }
    reader = dataType[0];
    if (!reader) {
      return {
        error: new Error("missing reader for entity metadata type name " + typeName)
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
  var length = readVarInt(buffer, offset);
  if (!!!length) return null;
  var cursor = offset + length.size;
  var stringLength = length.value;
  var strEnd = cursor + stringLength;
  if (strEnd > buffer.length) return null;
  
  var value = buffer.toString('utf8', cursor, strEnd);
  cursor = strEnd;
  
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

function readStringArray (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var stringArray = [];
  for (var i = 0; i < count; ++i) {
    results = readString(buffer, cursor);
    if (! results) return null;
    stringArray.push(results.value);
    cursor += results.size;
  }

  return {
    value: stringArray,
    size: cursor - offset,
  };
}

function readUUID(buffer, offset) {
  if (offset + 16 > buffer.length) return null;
  return {
    value: [
      buffer.readInt32BE(offset),
      buffer.readInt32BE(offset + 4),
      buffer.readInt32BE(offset + 8),
      buffer.readInt32BE(offset + 12),
    ],
    size: 16,
  };
}

function readPropertyArray (buffer, offset) {
  var results = readInt(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var propertyArray = [];
  for (var i = 0; i < count; ++i) {
    var property = {};
    var elementListLength;

    results = readString(buffer, cursor);
    if (! results) return null;
    property.key = results.value;
    cursor += results.size;

    results = readDouble(buffer, cursor);
    if (! results) return null;
    property.value = results.value;
    cursor += results.size;

    results = readShort(buffer, cursor);
    if (! results) return null;
    elementListLength = results.value;
    cursor += results.size;

    property.elementList = [];
    for (var j = 0; j < elementListLength ; j++) {
      property.elementList[j] = {};

      results = readUUID(buffer, cursor);
      if (! results) return null;
      property.elementList[j].uuid = results.value;
      cursor += results.size;

      results = readDouble(buffer, cursor);
      if (! results) return null;
      property.elementList[j].amount = results.value;
      cursor += results.size;

      results = readByte(buffer, cursor);
      if (! results) return null;
      property.elementList[j].operation = results.value;
      cursor += results.size;

    }

    propertyArray.push(property);
  }

  return {
    value: propertyArray,
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
  if (nbtDataEnd > buffer.length) return null;
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

function sizeOfSlot(value) {
  return value.id === -1 ? 2 : 7 + value.nbtData.length;
}

function writeSlot(value, buffer, offset) {
  buffer.writeInt16BE(value.id, offset);
  if (value.id === -1) return offset + 2;
  buffer.writeInt8(value.itemCount, offset + 2);
  buffer.writeInt16BE(value.itemDamage, offset + 3);
  var nbtDataSize = value.nbtData.length;
  if (nbtDataSize === 0) nbtDataSize = -1; // I don't know wtf mojang smokes
  buffer.writeInt16BE(nbtDataSize, offset + 5);
  value.nbtData.copy(buffer, offset + 7);
  return offset + 7 + value.nbtData.length;
}

function sizeOfString(value) {
  var length = Buffer.byteLength(value, 'utf8');
  assert.ok(length < STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(length) + length;
}

function sizeOfUString(value) {
  var length = Buffer.byteLength(value, 'utf8');
  assert.ok(length < SRV_STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(length) + length;
}

function writeString(value, buffer, offset) {
  var length = Buffer.byteLength(value, 'utf8');
  offset = writeVarInt(length, buffer, offset);
  buffer.write(value, offset, length, 'utf8');
  return offset + length;
}

function sizeOfAscii(value) {
  return 2 + value.length;
}

function writeAscii(value, buffer, offset) {
  buffer.writeInt16BE(value.length, offset);
  offset += 2;

  for (var i = 0; i < value.length; ++i) {
    buffer.writeUInt8(value.charCodeAt(i), offset);
    offset += 1;
  }
  return offset;
}

function sizeOfByteArray16(value) {
  assert.ok(Buffer.isBuffer(value), "non buffer passed to ByteArray16Writer");
  return 2 + value.length;
}

function writeByteArray16(value, buffer, offset) {
  buffer.writeInt16BE(value.length, offset);
  value.copy(buffer, offset + 2);
  return offset + 2 + value.length;
}

function writeByte(value, buffer, offset) {
  buffer.writeInt8(value, offset);
  return offset + 1;
}

function writeBool(value, buffer, offset) {
  buffer.writeInt8(+value, offset);
  return offset + 1;
}

function writeUByte(value, buffer, offset) {
  buffer.writeUInt8(value, offset);
  return offset + 1;
}

function writeFloat(value, buffer, offset) {
  buffer.writeFloatBE(value, offset);
  return offset + 4;
}

function writeDouble(value, buffer, offset) {
  buffer.writeDoubleBE(value, offset);
  return offset + 8;
}

function writeShort(value, buffer, offset) {
  buffer.writeInt16BE(value, offset);
  return offset + 2;
}

function writeUShort(value, buffer, offset) {
  buffer.writeUInt16BE(value, offset);
  return offset + 2;
}

function writeInt(value, buffer, offset) {
  buffer.writeInt32BE(value, offset);
  return offset + 4;
}

function writeLong(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  return offset + 8;
}

function readVarInt(buffer, offset) {
  var result = 0;
  var shift = 0;
  var cursor = offset;
    
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    var b = buffer.readUInt8(cursor);
    result |= ((b & 0x7f) << shift); // Add the bits to our number, except MSB
    cursor++;
    if (!(b & 0x80)) { // If the MSB is not set, we return the number
      return {
        value: result,
        size: cursor - offset
      };
    }
    shift += 7; // we only have 7 bits, MSB being the return-trigger
    assert.ok(shift < 64, "varint is too big"); // Make sure our shift don't overflow.
  }
}

function sizeOfVarInt(value) {
  var cursor = 0;
  while (value & ~0x7F) {
    value >>>= 7;
    cursor++;
  }
  return cursor + 1;
}

function writeVarInt(value, buffer, offset) {
  var cursor = 0;
  while (value & ~0x7F) {
    buffer.writeUInt8((value & 0xFF) | 0x80, offset + cursor);
    cursor++;
    value >>>= 7;
  }
  buffer.writeUInt8(value, offset + cursor);
  return offset + cursor + 1;
}

function readStatisticArray(buffer, offset) {
  var lenWrapper = readVarInt(buffer, offset);
  if (!lenWrapper) return null;
  var len = lenWrapper.value;
  var cursor = offset + lenWrapper.size;
  var returnVal = {};
  for (var i = 0; i < len; i++) {
    var statNameWrapper = readString(buffer, cursor);
    if (!statNameWrapper) return null;
    cursor += statNameWrapper.size;
    
    var valueWrapper = readVarInt(buffer, cursor);
    if (!valueWrapper) return null;
    cursor += valueWrapper.size;
    
    returnVal[statNameWrapper.value] = valueWrapper.value;
  }
  
  return {
    value: returnVal,
    size: cursor - offset
  }
}

function sizeOfStatisticArray(value) {
  return Object.keys(value).reduce(function(size, key) {
    size += sizeOfString(key);
    size += sizeOfVarInt(value[key]);
    return size;
  }, sizeOfVarInt(Object.keys(value).length));
}

function writeStatisticArray(value, buffer, offset) {
  var cursor = offset;
  cursor = writeVarInt(Object.keys(value).length, buffer, cursor);
  Object.keys(value).forEach(function(key) {
    cursor = writeString(key, buffer, cursor);
    cursor = writeVarInt(value[key], buffer, cursor);
  });
  return cursor;
}

function readMatchArray(buffer, offset) {
    var lengthWrapper = readVarInt(buffer, offset);
    if (!!!lengthWrapper) return null;
    var cursor = offset + lengthWrapper.size;
    var matches = [];
    for (var i = 0;i < lengthWrapper.value;i++) {
      var match = readString(buffer, cursor);
      if (!!!match) return null;
      cursor += match.size;
      matches[i] = match.value;
    }
    return {
        value: matches,
        size: cursor - offset
    };
}

function sizeOfMatchArray(value) {
    var size = sizeOfVarInt(value.length);
    for (var s in value) {
        size += sizeOfString(value);
    }
    return size;
}

function writeMatchArray(value, buffer, offset) {
    offset = writeVarInt(value.length, buffer, offset);
    for (var s in value) {
        offset = writeString(s, buffer, offset);
    }
    return offset;
}

function get(packetId, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packets[state][direction][packetId];
  if (!packetInfo) {
    return null;
  }
  return packetInfo;
}

function sizeOf(type, value) {
  var dataType = types[type];
  assert.ok(dataType, "unknown data type " + type);
  var size = dataType[2];
  if (typeof size === "function") {
    return size(value);
  } else {
    return size;
  }
}

function createPacketBuffer(packetId, state, params, isServer) {
  var length = 0;
  var packet = get(packetId, state, !isServer);
  assert.notEqual(packet, null);
  packet.forEach(function(fieldInfo) {
    var condition = fieldInfo.condition;
    if (typeof condition != "undefined" && !condition(params))
      return;
    length += sizeOf(fieldInfo.type, params[fieldInfo.name]);
  });
  length += sizeOfVarInt(packetId);
  var size = length + sizeOfVarInt(length);
  var buffer = new Buffer(size);
  var offset = writeVarInt(length, buffer, 0);
  offset = writeVarInt(packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    var condition = fieldInfo.condition;
    if (typeof condition != "undefined" && !condition(params))
      return;
    var write = types[fieldInfo.type][1];
    var value = params[fieldInfo.name];
    if(typeof value === "undefined") value = 0;
    offset = write(value, buffer, offset);
  });
  return buffer;
}

function parsePacket(buffer, state, isServer) {

  function readPacketField(fieldInfo) {
    var read = types[fieldInfo.type][0];
    if (!read) {
      return {
        error: new Error("missing reader for data type: " + fieldInfo.type)
      }
    }
    var readResults = read(buffer, cursor);
    if (! readResults) return null; // buffer needs to be more full
    if (readResults.error) return { error: readResults.error };

    return readResults;
  }
  var cursor = 0;
  var lengthField = readVarInt(buffer, 0);
  if (!!!lengthField) return null;
  var length = lengthField.value;
  cursor += lengthField.size;
  if (length + lengthField.size > buffer.length) return null;
  var buffer = buffer.slice(0, length + cursor); // fail early if too much is read.

  var packetIdField = readVarInt(buffer, lengthField.size);
  var packetId = packetIdField.value;
  cursor += packetIdField.size;

  var results = { id: packetId };
  var packetInfo = get(packetId, state, isServer);
  if (packetInfo === null) {
    return {
      error: new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")"),
      size: length + lengthField.size,
      results: results
    }
  } else {
    debug("read packetId " + packetId + " (0x" + packetId.toString(16) + ")");
  }
  
  var i, fieldInfo, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    var condition = fieldInfo.condition;
    if (typeof condition != "undefined" && !condition(results)) {
      results[fieldInfo.name] = null;
      continue;
    }
    readResults = readPacketField(fieldInfo);
    if (!!!readResults) {
        var error = new Error("A deserializer returned null");
        error.packetId = packetId;
        error.fieldInfo = fieldInfo.name;
        return {
            size: length + lengthField.size,
            error: error,
            results: results
        };
    }
    if (readResults.error) {
      return readResults;
    }
    results[fieldInfo.name] = readResults.value;
    cursor += readResults.size;
  }
  debug(results);
  return {
    size: length + lengthField.size,
    results: results,
  };
}

module.exports = {
  version: 4,
  minecraftVersion: '1.7.2',
  sessionVersion: 13,
  parsePacket: parsePacket,
  createPacketBuffer: createPacketBuffer,
  STRING_MAX_LENGTH: STRING_MAX_LENGTH,
  packets: packets,
  states: states,
  get: get,
  debug: debug,
};
