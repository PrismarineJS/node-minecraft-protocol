module.exports = {
  meta: {
    protocolVersion: 51,
    sessionVersion: 13
  },
  0x00: [
    {
      name: "keepAliveId",
      type: "int"
    }
  ],
  0x01: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "levelType",
      type: "string"
    },
    {
      name: "gameMode",
      type: "byte"
    },
    {
      name: "dimension",
      type: "byte"
    },
    {
      name: "difficulty",
      type: "byte"
    },
    {
      name: "_notUsed1",
      type: "byte"
    },
    {
      name: "maxPlayers",
      type: "byte"
    }
  ],
  0x02: [
    {
      name: "protocolVersion",
      type: "byte"
    },
    {
      name: "username",
      type: "string"
    },
    {
      name: "serverHost",
      type: "string"
    },
    {
      name: "serverPort",
      type: "int"
    }
  ],
  0x03: [
    {
      name: "message",
      type: "string"
    }
  ],
  0x04: [
    {
      name: "ageOfWorld",
      type: "long"
    },
    {
      name: "timeOfDay",
      type: "long"
    }
  ],
  0x05: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "slot",
      type: "short"
    },
    {
      name: "item",
      type: "slot"
    }
  ],
  0x06: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    }
  ],
  0x07: [
    {
      name: "user",
      type: "int"
    },
    {
      name: "target",
      type: "int"
    },
    {
      name: "mouseButton",
      type: "bool"
    }
  ],
  0x08: [
    {
      name: "health",
      type: "short"
    },
    {
      name: "food",
      type: "short"
    },
    {
      name: "foodSaturation",
      type: "float"
    }
  ],
  0x09: [
    {
      name: "dimension",
      type: "int"
    },
    {
      name: "difficulty",
      type: "byte"
    },
    {
      name: "gameMode",
      type: "byte"
    },
    {
      name: "worldHeight",
      type: "short"
    },
    {
      name: "levelType",
      type: "string"
    }
  ],
  0x0a: [
    {
      name: "onGround",
      type: "bool"
    }
  ],
  0x0b: [
    {
      name: "x",
      type: "double"
    },
    {
      name: "y",
      type: "double"
    },
    {
      name: "stance",
      type: "double"
    },
    {
      name: "z",
      type: "double"
    },
    {
      name: "onGround",
      type: "bool"
    }
  ],
  0x0c: [
    {
      name: "yaw",
      type: "float"
    },
    {
      name: "pitch",
      type: "float"
    },
    {
      name: "onGround",
      type: "bool"
    }
  ],
  0x0d: [
    {
      name: "x",
      type: "double"
    },
    {
      name: "y",
      type: "double"
    },
    {
      name: "stance",
      type: "double"
    },
    {
      name: "z",
      type: "double"
    },
    {
      name: "yaw",
      type: "float"
    },
    {
      name: "pitch",
      type: "float"
    },
    {
      name: "onGround",
      type: "bool"
    }
  ],
  0x0e: [
    {
      name: "status",
      type: "byte"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "byte"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "face",
      type: "byte"
    }
  ],
  0x0f: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "ubyte"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "direction",
      type: "byte"
    },
    {
      name: "heldItem",
      type: "slot"
    },
    {
      name: "cursorX",
      type: "byte"
    },
    {
      name: "cursorY",
      type: "byte"
    },
    {
      name: "cursorZ",
      type: "byte"
    }
  ],
  0x10: [
    {
      name: "slotId",
      type: "short"
    }
  ],
  0x11: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "_unknown",
      type: "byte"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "byte"
    },
    {
      name: "z",
      type: "int"
    }
  ],
  0x12: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "animation",
      type: "byte"
    }
  ],
  0x13: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "actionId",
      type: "byte"
    }
  ],
  0x14: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "playerName",
      type: "string"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    },
    {
      name: "currentItem",
      type: "short"
    },
    {
      name: "metadata",
      type: "entityMetadata"
    }
  ],
  0x16: [
    {
      name: "collectedEntityId",
      type: "int"
    },
    {
      name: "collectorEntityId",
      type: "int"
    }
  ],
  0x17: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "type",
      type: "byte"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    },
    {
      name: "objectData",
      type: "objectData"
    }
  ],
  0x18: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "type",
      type: "byte"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    },
    {
      name: "headYaw",
      type: "byte"
    },
    {
      name: "velocityX",
      type: "short"
    },
    {
      name: "velocityY",
      type: "short"
    },
    {
      name: "velocityZ",
      type: "short"
    },
    {
      name: "metadata",
      type: "entityMetadata"
    }
  ],
  0x19: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "title",
      type: "string"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "direction",
      type: "int"
    }
  ],
  0x1a: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "count",
      type: "short"
    }
  ],
  0x1c: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "velocityX",
      type: "short"
    },
    {
      name: "velocityY",
      type: "short"
    },
    {
      name: "velocityZ",
      type: "short"
    }
  ],
  0x1d: [
    {
      name: "entityIds",
      type: "intArray"
    }
  ],
  0x1e: [
    {
      name: "entityId",
      type: "int"
    }
  ],
  0x1f: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "deltaX",
      type: "byte"
    },
    {
      name: "deltaY",
      type: "byte"
    },
    {
      name: "deltaZ",
      type: "byte"
    }
  ],
  0x20: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    }
  ],
  0x21: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "deltaX",
      type: "byte"
    },
    {
      name: "deltaY",
      type: "byte"
    },
    {
      name: "deltaZ",
      type: "byte"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    }
  ],
  0x22: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "yaw",
      type: "byte"
    },
    {
      name: "pitch",
      type: "byte"
    }
  ],
  0x23: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "headYaw",
      type: "byte"
    }
  ],
  0x26: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "entityStatus",
      type: "byte"
    }
  ],
  0x27: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "vehicleId",
      type: "int"
    }
  ],
  0x28: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "metadata",
      type: "entityMetadata"
    }
  ],
  0x29: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "effectId",
      type: "byte"
    },
    {
      name: "amplifier",
      type: "byte"
    },
    {
      name: "duration",
      type: "short"
    }
  ],
  0x2a: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "effectId",
      type: "byte"
    }
  ],
  0x2b: [
    {
      name: "experienceBar",
      type: "float"
    },
    {
      name: "level",
      type: "short"
    },
    {
      name: "totalExperience",
      type: "short"
    }
  ],
  0x33: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "groundUpContinuous",
      type: "bool"
    },
    {
      name: "primaryBitMap",
      type: "ushort"
    },
    {
      name: "addBitMap",
      type: "ushort"
    },
    {
      name: "compressedData",
      type: "byteArray32"
    }
  ],
  0x34: [
    {
      name: "chunkX",
      type: "int"
    },
    {
      name: "chunkZ",
      type: "int"
    },
    {
      name: "recordCount",
      type: "short"
    },
    {
      name: "data",
      type: "byteArray32"
    }
  ],
  0x35: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "byte"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "blockType",
      type: "short"
    },
    {
      name: "blockMetadata",
      type: "byte"
    }
  ],
  0x36: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "short"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "byte1",
      type: "byte"
    },
    {
      name: "byte2",
      type: "byte"
    },
    {
      name: "blockId",
      type: "short"
    }
  ],
  0x37: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "destroyStage",
      type: "byte"
    }
  ],
  0x38: [
    {
      name: "data",
      type: "mapChunkBulk"
    }
  ],
  0x3c: [
    {
      name: "x",
      type: "double"
    },
    {
      name: "y",
      type: "double"
    },
    {
      name: "z",
      type: "double"
    },
    {
      name: "radius",
      type: "float"
    },
    {
      name: "affectedBlockOffsets",
      type: "byteVectorArray"
    },
    {
      name: "playerMotionX",
      type: "float"
    },
    {
      name: "playerMotionY",
      type: "float"
    },
    {
      name: "playerMotionZ",
      type: "float"
    }
  ],
  0x3d: [
    {
      name: "effectId",
      type: "int"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "byte"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "data",
      type: "int"
    },
    {
      name: "disableRelativeVolume",
      type: "bool"
    }
  ],
  0x3e: [
    {
      name: "soundName",
      type: "string"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "volume",
      type: "float"
    },
    {
      name: "pitch",
      type: "byte"
    }
  ],
  0x46: [
    {
      name: "reason",
      type: "byte"
    },
    {
      name: "gameMode",
      type: "byte"
    }
  ],
  0x47: [
    {
      name: "entityId",
      type: "int"
    },
    {
      name: "type",
      type: "byte"
    },
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "int"
    },
    {
      name: "z",
      type: "int"
    }
  ],
  0x64: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "inventoryType",
      type: "byte"
    },
    {
      name: "windowTitle",
      type: "string"
    },
    {
      name: "slotCount",
      type: "byte"
    }
  ],
  0x65: [
    {
      name: "windowId",
      type: "byte"
    }
  ],
  0x66: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "slot",
      type: "short"
    },
    {
      name: "mouseButton",
      type: "byte"
    },
    {
      name: "actionNumber",
      type: "short"
    },
    {
      name: "shift",
      type: "bool"
    },
    {
      name: "clickedItem",
      type: "slot"
    }
  ],
  0x67: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "slotId",
      type: "short"
    },
    {
      name: "slot",
      type: "slot"
    }
  ],
  0x68: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "slots",
      type: "slotArray"
    }
  ],
  0x69: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "property",
      type: "short"
    },
    {
      name: "value",
      type: "short"
    }
  ],
  0x6a: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "actionNumber",
      type: "short"
    },
    {
      name: "accepted",
      type: "bool"
    }
  ],
  0x6b: [
    {
      name: "slot",
      type: "short"
    },
    {
      name: "clickedItem",
      type: "slot"
    }
  ],
  0x6c: [
    {
      name: "windowId",
      type: "byte"
    },
    {
      name: "enchantment",
      type: "byte"
    }
  ],
  0x82: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "short"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "text1",
      type: "string"
    },
    {
      name: "text2",
      type: "string"
    },
    {
      name: "text3",
      type: "string"
    },
    {
      name: "text4",
      type: "string"
    }
  ],
  0x83: [
    {
      name: "itemType",
      type: "short"
    },
    {
      name: "itemId",
      type: "short"
    },
    {
      name: "text",
      type: "ascii"
    }
  ],
  0x84: [
    {
      name: "x",
      type: "int"
    },
    {
      name: "y",
      type: "short"
    },
    {
      name: "z",
      type: "int"
    },
    {
      name: "action",
      type: "byte"
    },
    {
      name: "nbtData",
      type: "byteArray16"
    }
  ],
  0xc8: [
    {
      name: "statisticId",
      type: "int"
    },
    {
      name: "amount",
      type: "byte"
    }
  ],
  0xc9: [
    {
      name: "playerName",
      type: "string"
    },
    {
      name: "online",
      type: "bool"
    },
    {
      name: "ping",
      type: "short"
    }
  ],
  0xca: [
    {
      name: "flags",
      type: "byte"
    },
    {
      name: "flyingSpeed",
      type: "byte"
    },
    {
      name: "walkingSpeed",
      type: "byte"
    }
  ],
  0xcb: [
    {
      name: "text",
      type: "string"
    }
  ],
  0xcc: [
    {
      name: "locale",
      type: "string"
    },
    {
      name: "viewDistance",
      type: "byte"
    },
    {
      name: "chatFlags",
      type: "byte"
    },
    {
      name: "difficulty",
      type: "byte"
    },
    {
      name: "showCape",
      type: "bool"
    }
  ],
  0xcd: [
    {
      name: "payload",
      type: "byte"
    }
  ],
  0xfa: [
    {
      name: "channel",
      type: "string"
    },
    {
      name: "data",
      type: "byteArray16"
    }
  ],
  0xfc: [
    {
      name: "sharedSecret",
      type: "byteArray16"
    },
    {
      name: "verifyToken",
      type: "byteArray16"
    }
  ],
  0xfd: [
    {
      name: "serverId",
      type: "string"
    },
    {
      name: "publicKey",
      type: "byteArray16"
    },
    {
      name: "verifyToken",
      type: "byteArray16"
    }
  ],
  0xfe: [
    {
      name: "magic",
      type: "byte"
    }
  ],
  0xff: [
    {
      name: "reason",
      type: "string"
    }
  ]
};
