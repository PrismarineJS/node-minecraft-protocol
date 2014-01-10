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
        { name: "countPublicKey", type: "short" },
        { name: "publicKey", type: "byte", count: "countPublicKey" },
        { name: "countVerifyToken", type: "short" },
        { name: "verifyToken", type: "byte", count: "countVerifyToken" }
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
        { name: "countSharedSecret", type: "short" },
        { name: "sharedSecret", type: "byte", count: "countSharedSecret" },
        { name: "countVerifyToken", type: "short" },
        { name: "verifyToken", type: "byte", count: "countVerifyToken" }
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
        { name: "count", type: "byte" },
        { name: "entityIds", type: "int", count: "count" }
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
        { name: "count", type: "int" },
        { name: "properties", type: "container", count: "count", contents: [
          { name: "key", type: "string" },
          { name: "value", type: "double" },
          { name: "listLength", type: "short" },
          { name: "modifiers", type: "container", count: "listLength", contents: [
            { name: "uuid", type: "UUID" },
            { name: "amount", type: "double" },
            { name: "operation", type: "byte" }
          ]}
        ]}
      ],
      0x21: [
        { name: "x", type: "int" },
        { name: "z", type: "int" },
        { name: "groundUp", type: "bool" },
        { name: "bitMap", type: "ushort" },
        { name: "addBitMap", type: "ushort" },
        { name: "compressedSize", type: "int" },
        { name: "compressedChunkData", type: "byte", count: "compressedSize" }
      ],
      0x22: [
        { name: "chunkX", type: "int" },
        { name: "chunkZ", type: "int" },
        { name: "recordCount", type: "short" },
        { name: "dataSize", type: "int" },
        { name: "data", type: "byte", count: "dataSize" }
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
        { name: "columnCount", type: "short" },
        { name: "dataLength", type: "int" },
        { name: "skyLight", type: "bool" },
        { name: "chunkData", type: "byte", count: "dataLength" },
        { name: "meta", type: "container", count: "columnCount", contents: [
          { name: "chunkX", type: "int" },
          { name: "chunkZ", type: "int" },
          { name: "bitMap", type: "ushort" },
          { name: "addBitMap", type: "ushort" }
        ]}
      ],
      0x27: [
        { name: "x", type: "float" },
        { name: "y", type: "float" },
        { name: "z", type: "float" },
        { name: "radius", type: "float" },
        { name: "recordCount", type: "int" },
        { name: "affectedBlockOffsets", type: "container", count: "recordCount", contents: [
          { name: "x", type: "byte" },
          { name: "y", type: "byte" },
          { name: "z", type: "byte" }
        ]},
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
        { name: "count", type: "short" },
        { name: "items", type: "slot", count: "count" }
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
        { name: "dataLength", type: "short" },
        { name: "data", type: "byte", count: "dataLength" }
      ],
      0x35: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "action", type: "ubyte" },
        { name: "nbtDataLength", type: "short" },
        { name: "nbtData", type: "byte", count: "nbtDataLength" }
      ],
      0x36: [
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ],
      0x37: [
        { name: "count", type: "varint" },
        { name: "entry", type: "container", count: "count", contents: [
          { name: "name", type: "string" },
          { name: "value", type: "varint" }
        ]}
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
        { name: "count", type: "varint" },
        { name: "matches", type: "string", count: "count" }
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
        { name: "informationUpdate", type: "container", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        }, contents: [
          { name: "name", type: "string" },
          { name: "prefix", type: "string" },
          { name: "suffix", type: "string" },
          { name: "friendlyFire", type: "string" },
        ]},
        { name: "playerChange", type: "container", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 3 || field_values['mode'] == 4;
        }, contents: [
          { name: "playerCount", type: "short" },
          { name: "players", type: "string", count: "playerCount" }
        ] }
      ],
      0x3F: [
        { name: "channel", type: "string" },
        { name: "dataLength", type: "short" },
        { name: "data", type: "byte", count: "dataLength" }
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
        { name: "leftClick", type: "byte" }
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
        { name: "dataLength", type: "short" },
        { name: "data", type: "byte", count: "dataLength" }
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
  'bool': [readBool, writeBool, 1],
  'double': [readDouble, writeDouble, 8],
  'float': [readFloat, writeFloat, 4],
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'long': [readLong, writeLong, 8],
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'ascii': [readAscii, writeAscii, sizeOfAscii],
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
  'objectData': [readObjectData, writeObjectData, sizeOfObjectData],
  'container': [readContainer, writeContainer, sizeOfContainer],
  'UUID': [readUUID, writeUUID, 16],
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

function writeUUID(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  buffer.writeInt32BE(value[2], offset + 8);
  buffer.writeInt32BE(value[3], offset + 12);
  return offset + 16;
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

function sizeOfString(value) {
  assert.ok(value.length < STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(value.length) + value.length;
}

function sizeOfUString(value) {
  assert.ok(value.length < SRV_STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(value.length) + value.length;
}

function writeString(value, buffer, offset) {
  offset = writeVarInt(value.length, buffer, offset);
  buffer.write(value, offset, value.length, 'utf8');
  return offset + value.length;
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

function writeShort(value, buffer, offset) {
  buffer.writeInt16BE(value, offset);
  return offset + 2;
}

function readShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function writeUShort(value, buffer, offset) {
  buffer.writeUInt16BE(value, offset);
  return offset + 2;
}

function readUShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readUInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function writeInt(value, buffer, offset) {
  buffer.writeInt32BE(value, offset);
  return offset + 4;
}

function readInt(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readInt32BE(offset);
  return {
    value: value,
    size: 4,
  };
}

function writeFloat(value, buffer, offset) {
  buffer.writeFloatBE(value, offset);
  return offset + 4;
}

function readFloat(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readFloatBE(offset);
  return {
    value: value,
    size: 4,
  };
}

function writeDouble(value, buffer, offset) {
  buffer.writeDoubleBE(value, offset);
  return offset + 8;
}

function readDouble(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  var value = buffer.readDoubleBE(offset);
  return {
    value: value,
    size: 8,
  };
}

function writeLong(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  return offset + 8;
}

function readLong(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  return {
    value: [buffer.readInt32BE(offset), buffer.readInt32BE(offset + 4)],
    size: 8,
  };
}

function writeByte(value, buffer, offset) {
  buffer.writeInt8(value, offset);
  return offset + 1;
}

function readByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function writeUByte(value, buffer, offset) {
  buffer.writeUInt8(value, offset);
  return offset + 1;
}

function readUByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readUInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function writeBool(value, buffer, offset) {
  buffer.writeInt8(+value, offset);
  return offset + 1;
}

function readBool(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: !!value,
    size: 1,
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

function sizeOfContainer(value, fieldInfo) {
  return fieldInfo.contents.reduce(function(size, subFieldInfo) {
    return size += sizeOf(subFieldInfo.type, value[subFieldInfo.name], fieldInfo.contents, subFieldInfo);
  }, 0);
}

function writeContainer(value, buffer, offset, packetInfo, fieldInfo) {
  var counters = {};
  fieldInfo.contents.forEach(function (subFieldInfo) {
    if ('count' in subFieldInfo) counters[subFieldInfo.count] = subFieldInfo.name;
  })
  fieldInfo.contents.forEach(function (subFieldInfo) {
    offset = write(subFieldInfo, value, buffer, offset, packetInfo, counters);
  });
  return offset;
}

function readContainer(buffer, offset, fieldInfo, results) {
  var results = {
    value: {},
    size: 0
  };
  fieldInfo.contents.forEach(function (subFieldInfo) {
    var readResults = read(subFieldInfo, buffer, offset, results);
    results.size += readResults.size;
    offset += readResults.size;
    results.value[subFieldInfo.name] = readResults.value;
  });
  return results;
}

function get(packetId, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packets[state][direction][packetId];
  if (!packetInfo) {
    return null;
  }
  return packetInfo;
}

function sizeOf(fieldInfo, params) {
  var condition = fieldInfo.condition;
  if (typeof condition != "undefined" && !condition(params))
    return 0;
  
  var dataType = types[fieldInfo.type];
  assert.ok(dataType, "unknown data type " + fieldInfo.type);
  var value = params[fieldInfo.name];
  var count = 1;

  if ('count' in fieldInfo) {
    count = value.length;
  } else {
    value = [value];
  }

  var dataSize = dataType[2];
  if (typeof dataSize === "function") {
    var size = 0;
    for (var i = 0;i < count;i++) {
      size += dataSize(value[i], fieldInfo);
    }
    return size;
  } else {
    return dataSize * count;
  }
}

function write(fieldInfo, params, buffer, offset, packetInfo, counters) {
  var condition = fieldInfo.condition;
  if (typeof condition != "undefined" && !condition(params))
    return offset;
  
  var dataType = types[fieldInfo.type];
  assert.ok(dataType, "unknown data type " + fieldInfo.type);
  
  var value = params[fieldInfo.name];
  if ('count' in fieldInfo) {
    var newFieldInfo = {
      type: fieldInfo.type,
      name: fieldInfo.name,
      contents: fieldInfo.contents
    };
    if (fieldInfo.type === "byte") {
      value.copy(buffer, offset);
      offset += value.length;
    } else {
      for (var i = 0;i < value.length; i++) {
        offset = write(newFieldInfo, value[i], buffer, offset, packetInfo, counters);
      }
    }
  } else {
    if (fieldInfo.name in counters) {
      offset = dataType[1](params[counters[fieldInfo.name]].length, buffer, offset, packetInfo, fieldInfo);
    } else {
      offset = dataType[1](value, buffer, offset, packetInfo, fieldInfo);
    }
  }
  return offset;
}

function read(fieldInfo, buffer, offset, results) {
  if (typeof condition != "undefined" && !condition(results)) {
    return {
      size: 0
    };
  }
  if ('count' in fieldInfo) {
    var newFieldInfo = {
      type: fieldInfo.type,
      name: fieldInfo.name,
      contents: fieldInfo.contents
    };
    var readResults = {
      value: new Array(results[fieldInfo.count]),
      size: 0
    };
    if (fieldInfo.type === "byte") {
      readResults.value = buffer.slice(offset, offset + results[fieldInfo.count]);
      readResults.size += results[fieldInfo.count];
    } else {
      for (var i = 0;i < results[fieldInfo.count];i++) {
        var subRead = read(newFieldInfo, buffer, offset, results);
        readResults.size += subRead.size;
        offset += subRead.size;
        readResults.value[i] = subRead.value;
      }
    }
    return readResults;
  } else {
    var dataType = types[fieldInfo.type];
    assert.ok(dataType, "unknown data type " + fieldInfo.type);  
    return dataType[0](buffer, offset, fieldInfo, results);
  }
}

function createPacketBuffer(packetId, state, params, isServer) {
  var packet = get(packetId, state, !isServer);
  assert.notEqual(packet, null);

  // Start by finding the array counters, and save them
  var counters = {};
  packet.forEach(function(fieldInfo) {
    if ('count' in fieldInfo) {
      counters[fieldInfo.count] = fieldInfo.name;
    }
  });
  
  var length = 0;
  packet.forEach(function(fieldInfo) {
   length += sizeOf(fieldInfo, params);
  });
  length += sizeOfVarInt(packetId);
  var size = length + sizeOfVarInt(length);
  var buffer = new Buffer(size);
  try {
    var offset = writeVarInt(length, buffer, 0);
  } catch (e) {
    throw e;
  }
  offset = writeVarInt(packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    offset = write(fieldInfo, params, buffer, offset, packet, counters);
  });
  return buffer;
}

function parsePacket(buffer, state, isServer) {
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
  }
  debug("read packetId " + packetId + " (0x" + packetId.toString(16) + ")");
  
  var i, fieldInfo, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    readResults = read(fieldInfo, buffer, cursor, results);
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
