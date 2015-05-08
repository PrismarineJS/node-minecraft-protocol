var assert = require('assert');
var util = require('util');
var zlib = require('zlib');
var nbt = require('prismarine-nbt');

var STRING_MAX_LENGTH = 240;
var SRV_STRING_MAX_LENGTH = 32767;

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
}

var packets=require("./protocol_def.js");

var packetFields = {};
var packetNames = {};
var packetIds = {};
var packetStates = {toClient: {}, toServer: {}};
(function() {
  for (var stateName in states) {
    var state = states[stateName];

    packetFields[state] = {toClient: [], toServer: []};
    packetNames[state] = {toClient: [], toServer: []};
    packetIds[state] = {toClient: [], toServer: []};

    ['toClient', 'toServer'].forEach(function(direction) {
      for (var name in packets[state][direction]) {
        var info = packets[state][direction][name];
        var id = parseInt(info.id);
        var fields = info.fields;

        assert(id !== undefined, 'missing id for packet '+name);
        assert(fields !== undefined, 'missing fields for packet '+name);
        assert(!packetNames[state][direction].hasOwnProperty(id), 'duplicate packet id '+id+' for '+name);
        assert(!packetIds[state][direction].hasOwnProperty(name), 'duplicate packet name '+name+' for '+id);
        assert(!packetFields[state][direction].hasOwnProperty(id), 'duplicate packet id '+id+' for '+name);
        assert(!packetStates[direction].hasOwnProperty(name), 'duplicate packet name '+name+' for '+id+', must be unique across all states');

        packetNames[state][direction][id] = name;
        packetIds[state][direction][name] = id;
        packetFields[state][direction][id] = fields;
        packetStates[direction][name] = state;
      }
    });
  }
})();



var types = {
  'byte': [readByte, writeByte, 1],
  'ubyte': [readUByte, writeUByte, 1],
  'short': [readShort, writeShort, 2],
  'ushort': [readUShort, writeUShort, 2],
  'int': [readInt, writeInt, 4],
  'long': [readLong, writeLong, 8],
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'float': [readFloat, writeFloat, 4],
  'double': [readDouble, writeDouble, 8],
  'bool': [readBool, writeBool, 1],
  'string': [readString, writeString, sizeOfString],
  'ustring': [readString, writeString, sizeOfUString], // TODO : remove ustring
  'UUID': [readUUID, writeUUID, 16],
  'container': [readContainer, writeContainer, sizeOfContainer],
  'array': [readArray, writeArray, sizeOfArray],
  'buffer': [readBuffer, writeBuffer, sizeOfBuffer],
  'restBuffer': [readRestBuffer, writeBuffer, sizeOfBuffer],
  'count': [readCount, writeCount, sizeOfCount],
  // TODO : remove type-specific, replace with generic containers and arrays.
  'position': [readPosition, writePosition, 8],
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'nbt': [readNbt, writeBuffer, sizeOfBuffer],
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
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
  0: { type: 'byte' },
  1: { type: 'short' },
  2: { type: 'int' },
  3: { type: 'float' },
  4: { type: 'string' },
  5: { type: 'slot' },
  6: { type: 'container', typeArgs: { fields: [
       { name: 'x', type: 'int' },
       { name: 'y', type: 'int' },
       { name: 'z', type: 'int' }
  ]}},
  7: { type: 'container', typeArgs: { fields: [
      { name: 'pitch', type: 'float' },
      { name: 'yaw', type: 'float' },
      { name: 'roll', type: 'float' }
  ]}}
};

// maps string type name to number
var entityMetadataTypeBytes = {};
for (var n in entityMetadataTypes) {
  if (!entityMetadataTypes.hasOwnProperty(n)) continue;

  entityMetadataTypeBytes[entityMetadataTypes[n].type] = n;
}

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function evalCondition(condition,field_values)
{
    if(!isFunction(condition))
    {
        var field_value_to_test="this" in condition && condition["this"] ? field_values["this"][condition.field] : field_values[condition.field];
        var b=condition.values.some(function(value) {return field_value_to_test===value;});
        if("different" in condition && condition["different"])
            return !b;
        else
            return b;
    }
    return condition(field_values);
}

function sizeOfEntityMetadata(value) {
  var size = 1 + value.length;
  var item;
  for (var i = 0; i < value.length; ++i) {
    item = value[i];
    size += sizeOf(item.value, entityMetadataTypes[entityMetadataTypeBytes[item.type]], {});
  }
  return size;
}

function writeEntityMetadata(value, buffer, offset) {
  value.forEach(function(item) {
    var type = entityMetadataTypeBytes[item.type];
    var headerByte = (type << 5) | item.key;
    buffer.writeUInt8(headerByte, offset);
    offset += 1;
    offset = write(item.value, buffer, offset, entityMetadataTypes[type], {});
  });
  buffer.writeUInt8(0x7f, offset);
  return offset + 1;
}

function writeUUID(value, buffer, offset) {
  buffer.writeUInt32BE(value[0], offset);
  buffer.writeUInt32BE(value[1], offset + 4);
  buffer.writeUInt32BE(value[2], offset + 8);
  buffer.writeUInt32BE(value[3], offset + 12);
  return offset + 16;
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
    dataType = entityMetadataTypes[type];
    typeName = dataType.type;
    //debug("Reading entity metadata type " + dataType + " (" + ( typeName || "unknown" ) + ")");
    if (!dataType) {
      return {
        error: new Error("unrecognized entity metadata type " + type)
      }
    }
    results = read(buffer, cursor, dataType, {});
    if (! results) return null;
    metadata.push({
      key: key,
      value: results.value,
      type: typeName,
    });
    cursor += results.size;
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

function readPosition(buffer, offset) {
  var longVal = readLong(buffer, offset).value;
  var x = signExtend26(longVal[0] >> 6);
  var y = signExtend12(((longVal[0] & 0x3f) << 6) | ((longVal[1] >> 26) & 0x3f));
  var z = signExtend26(longVal[1] & 0x3FFFFFF);
  return {
    value: { x: x, y: y, z: z },
    size: 8
  };
}
function signExtend26(value) {
  if (value > 0x2000000) value -= 0x4000000;
  return value;
}
function signExtend12(value) {
  if (value > 0x800) value -= 0x1000;
  return value;
}

function readSlot(buffer, offset) {
  var value = {};
  var results = readShort(buffer, offset);
  if (! results) return null;
  value.blockId = results.value;

  if (value.blockId === -1) {
    return {
      value: value,
      size: 2,
    };
  }

  var cursorEnd = offset + 6;
  if (cursorEnd > buffer.length) return null;
  value.itemCount = buffer.readInt8(offset + 2);
  value.itemDamage = buffer.readInt16BE(offset + 3);
  var nbtData = buffer.readInt8(offset + 5);
  if (nbtData == 0) {
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

function sizeOfSlot(value) {
  if (value.blockId === -1)
    return (2);
  else if (!value.nbtData) {
    return (6);
  } else {
    return (5 + sizeOfNbt(value.nbtData));
  }
}

function writePosition(value, buffer, offset) {
  var longVal = [];
  longVal[0] = ((value.x & 0x3FFFFFF) <<  6) | ((value.y & 0xFFF) >> 6);
  longVal[1] = ((value.y & 0x3F) << 26) | (value.z & 0x3FFFFFF);
  return writeLong(longVal, buffer, offset);
}

function writeSlot(value, buffer, offset) {
  buffer.writeInt16BE(value.blockId, offset);
  if (value.blockId === -1) return offset + 2;
  buffer.writeInt8(value.itemCount, offset + 2);
  buffer.writeInt16BE(value.itemDamage, offset + 3);
  var nbtDataLen;
  if (value.nbtData)
  {
    var newbuf = nbt.writeUncompressed(value.nbtData);
    newbuf.copy(buffer, offset + 5);
    nbtDataLen = newbuf.length;
  }
  else
  {
    buffer.writeInt8(0, offset + 5);
    nbtDataLen = 1;
  }
  return offset + 5 + nbtDataLen;
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

function readContainer(buffer, offset, typeArgs, rootNode) {
    var results = {
        value: {},
        size: 0
    };
    // BLEIGH. Huge hack because I have no way of knowing my current name.
    // TODO : either pass fieldInfo instead of typeArgs as argument (bleigh), or send name as argument (verybleigh).
    // TODO : what I do inside of roblabla/Protocols is have each "frame" create a new empty slate with just a "super" object pointing to the parent.
    rootNode.this = results.value;
    for (var index in typeArgs.fields) {
        var readResults = read(buffer, offset, typeArgs.fields[index], rootNode);
        if (readResults == null) { continue; }
        results.size += readResults.size;
        offset += readResults.size;
        results.value[typeArgs.fields[index].name] = readResults.value;
    }
    delete rootNode.this;
    return results;
}

function writeContainer(value, buffer, offset, typeArgs, rootNode) {
    var context = value.this ? value.this : value;
    rootNode.this = value;
    for (var index in typeArgs.fields) {
        if (!context.hasOwnProperty(typeArgs.fields[index].name) && typeArgs.fields[index].type != "count" && !typeArgs.fields[index].condition)
        {
          debug(new Error("Missing Property " + typeArgs.fields[index].name).stack);
          console.log(context);
        }
        offset = write(context[typeArgs.fields[index].name], buffer, offset, typeArgs.fields[index], rootNode);
    }
    delete rootNode.this;
    return offset;
}

function sizeOfContainer(value, typeArgs, rootNode) {
    var size = 0;
    var context = value.this ? value.this : value;
    rootNode.this = value;
    for (var index in typeArgs.fields) {
        size += sizeOf(context[typeArgs.fields[index].name], typeArgs.fields[index], rootNode);
    }
    delete rootNode.this;
    return size;
}

function readBuffer(buffer, offset, typeArgs, rootNode) {
    var count = getField(typeArgs.count, rootNode);
    return {
        value: buffer.slice(offset, offset + count),
        size: count
    };
}

function writeBuffer(value, buffer, offset) {
    value.copy(buffer, offset);
    return offset + value.length;
}

function sizeOfBuffer(value) {
    return value.length;
}

function readRestBuffer(buffer, offset, typeArgs, rootNode) {
    return {
        value: buffer.slice(offset),
        size: buffer.length - offset
    };
}

function evalCount(count,fields)
{
    if(fields[count["field"]] in count["map"])
        return count["map"][fields[count["field"]]];
    return count["default"];
}

function readArray(buffer, offset, typeArgs, rootNode) {
    var results = {
        value: [],
        size: 0
    }
    var count;
    if (typeof typeArgs.count === "object") {
        count = evalCount(typeArgs.count,rootNode);
    }
    else
      count = getField(typeArgs.count, rootNode);
    for (var i = 0; i < count; i++) {
        var readResults = read(buffer, offset, { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
        results.size += readResults.size;
        offset += readResults.size;
        results.value.push(readResults.value);
    }
    return results;
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
    for (var index in value) {
        offset = write(value[index], buffer, offset, { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
    }
    return offset;
}

function sizeOfArray(value, typeArgs, rootNode) {
    var size = 0;
    for (var index in value) {
        size += sizeOf(value[index], { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
    }
    return size;
}

function getField(countField, rootNode) {
    var countFieldArr = countField.split(".");
    var count = rootNode;
    for (var index = 0; index < countFieldArr.length; index++) {
        count = count[countFieldArr[index]];
    }
    return count;
}

function readCount(buffer, offset, typeArgs, rootNode) {
    return read(buffer, offset, { type: typeArgs.type }, rootNode);
}

function writeCount(value, buffer, offset, typeArgs, rootNode) {
    // Actually gets the required field, and writes its length. Value is unused.
    // TODO : a bit hackityhack.
    return write(getField(typeArgs.countFor, rootNode).length, buffer, offset, { type: typeArgs.type }, rootNode);
}

function sizeOfCount(value, typeArgs, rootNode) {
    // TODO : should I use value or getField().length ?
    /*console.log(rootNode);
    console.log(typeArgs);*/
    return sizeOf(getField(typeArgs.countFor, rootNode).length, { type: typeArgs.type }, rootNode);
}

function read(buffer, cursor, fieldInfo, rootNodes) {
  if (fieldInfo.condition && !evalCondition(fieldInfo.condition,rootNodes)) {
    return null;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  var readResults = type[0](buffer, cursor, fieldInfo.typeArgs, rootNodes);
  if (readResults == null) {
    throw new Error("Reader returned null : " + JSON.stringify(fieldInfo));
  }
  if (readResults && readResults.error) return { error: readResults.error };
  return readResults;
}

function write(value, buffer, offset, fieldInfo, rootNode) {
  if (fieldInfo.condition && !evalCondition(fieldInfo.condition,rootNode)) {
    return offset;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  return type[1](value, buffer, offset, fieldInfo.typeArgs, rootNode);
}

function sizeOf(value, fieldInfo, rootNode) {
  if (fieldInfo.condition && !evalCondition(fieldInfo.condition,rootNode)) {
    return 0;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    throw new Error("missing data type: " + fieldInfo.type);
  }
  if (typeof type[2] === 'function') {
    return type[2](value, fieldInfo.typeArgs, rootNode);
  } else {
    return type[2];
  }
}

function get(packetId, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packetFields[state][direction][packetId];
  if (!packetInfo) {
    return null;
  }
  return packetInfo;
}

// TODO : This does NOT contain the length prefix anymore.
function createPacketBuffer(packetId, state, params, isServer) {
  var length = 0;
  if (typeof packetId === 'string' && typeof state !== 'string' && !params) {
    // simplified two-argument usage, createPacketBuffer(name, params)
    params = state;
    state = packetStates[!isServer ? 'toServer' : 'toClient'][packetId];
  }
  if (typeof packetId === 'string') packetId = packetIds[state][!isServer ? 'toServer' : 'toClient'][packetId];
  assert.notEqual(packetId, undefined);

  var packet = get(packetId, state, !isServer);
  assert.notEqual(packet, null);
  packet.forEach(function(fieldInfo) {
    try {
    length += sizeOf(params[fieldInfo.name], fieldInfo, params);
    } catch (e) {
      console.log("fieldInfo : " + JSON.stringify(fieldInfo));
      console.log("params : " + JSON.stringify(params));
      throw e;
    }
  });
  length += sizeOfVarInt(packetId);
  var size = length;// + sizeOfVarInt(length);
  var buffer = new Buffer(size);
  var offset = 0;//writeVarInt(length, buffer, 0);
  offset = writeVarInt(packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    // TODO : A better check is probably needed
    if(typeof value === "undefined" && fieldInfo.type != "count" && !fieldInfo.condition)
      debug(new Error("Missing Property " + fieldInfo.name).stack);
    offset = write(value, buffer, offset, fieldInfo, params);
  });
  return buffer;
}

function compressPacketBuffer(buffer, callback) {
  var dataLength = buffer.size;
  zlib.deflate(buffer, function(err, buf) {
    if (err)
      callback(err);
    else
      newStylePacket(buffer, callback);
  });
}

function oldStylePacket(buffer, callback) {
  var packet = new Buffer(sizeOfVarInt(buffer.length) + buffer.length);
  var cursor = writeVarInt(buffer.length, packet, 0);
  writeBuffer(buffer, packet, cursor);
  callback(null, packet);
}

function newStylePacket(buffer, callback) {
  var sizeOfDataLength = sizeOfVarInt(0);
  var sizeOfLength = sizeOfVarInt(buffer.length + sizeOfDataLength);
  var size = sizeOfLength + sizeOfDataLength + buffer.length;
  var packet = new Buffer(size);
  var cursor = writeVarInt(size - sizeOfLength, packet, 0);
  cursor = writeVarInt(0, packet, cursor);
  writeBuffer(buffer, packet, cursor);
  callback(null, packet);
}

function parsePacketData(buffer, state, isServer, packetsToParse) {
  var cursor = 0;
  var packetIdField = readVarInt(buffer, cursor);
  var packetId = packetIdField.value;
  cursor += packetIdField.size;

  var results = { id: packetId, state: state };
  // Only parse the packet if there is a need for it, AKA if there is a listener attached to it
  var name = packetNames[state][isServer ? "toServer" : "toClient"][packetId];
  var shouldParse = (!packetsToParse.hasOwnProperty(name) || packetsToParse[name] <= 0)
                    && (!packetsToParse.hasOwnProperty("packet") || packetsToParse["packet"] <= 0);
  if (shouldParse) {
    return {
      buffer: buffer,
      results: results
    };
  }

  var packetInfo = get(packetId, state, isServer);
  if (packetInfo === null) {
    return {
      error: new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")"),
      buffer: buffer,
      results: results
    };
  } else {
    var packetName = packetNames[state][isServer ? "toServer" : "toClient"][packetId];
    debug("read packetId " + state + "." + packetName + " (0x" + packetId.toString(16) + ")");
  }

  var i, fieldInfo, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    readResults = read(buffer, cursor, fieldInfo, results);
    /* A deserializer cannot return null anymore. Besides, read() returns
     * null when the condition is not fulfilled.
     if (!!!readResults) {
        var error = new Error("A deserializer returned null");
        error.packetId = packetId;
        error.fieldInfo = fieldInfo.name;
        return {
            size: length + lengthField.size,
            error: error,
            results: results
        };
    }*/
    if (readResults === null) continue;
    if (readResults.error) {
      return readResults;
    }
    results[fieldInfo.name] = readResults.value;
    cursor += readResults.size;
  }
  if (buffer.length > cursor)
    debug("Too much data to read for packetId: " + packetId + " (0x" + packetId.toString(16) + ")");
  debug(results);
  return {
    results: results,
    buffer: buffer
  };
}

function parsePacket(buffer, state, isServer, packetsToParse) {
  if (state == null) state = states.PLAY;
  var cursor = 0;
  var lengthField = readVarInt(buffer, 0);
  if (!!!lengthField) return null;
  var length = lengthField.value;
  cursor += lengthField.size;
  if (length + lengthField.size > buffer.length) return null; // fail early
  var result = parsePacketData(buffer.slice(cursor, length + cursor), state, isServer, packetsToParse);
  result.size = lengthField.size + length;
  return result;
}

function parseNewStylePacket(buffer, state, isServer, packetsToParse, cb) {
  var dataLengthField = readVarInt(buffer, 0);
  var buf = buffer.slice(dataLengthField.size);
  if(dataLengthField.value != 0) {
    zlib.inflate(buf, function(err, newbuf) {
      if (err) {
        console.log(err);
        cb(err);
      } else {
        cb(null, parsePacketData(newbuf, state, isServer, packetsToParse));
      }
    });
  } else {
    cb(null, parsePacketData(buf, state, isServer, packetsToParse));
  }
}

module.exports = {
  version: 47,
  minecraftVersion: '1.8.1',
  sessionVersion: 13,
  parsePacket: parsePacket,
  parsePacketData: parsePacketData,
  parseNewStylePacket: parseNewStylePacket,
  createPacketBuffer: createPacketBuffer,
  compressPacketBuffer: compressPacketBuffer,
  oldStylePacket: oldStylePacket,
  newStylePacket: newStylePacket,
  STRING_MAX_LENGTH: STRING_MAX_LENGTH,
  packetIds: packetIds,
  packetNames: packetNames,
  packetFields: packetFields,
  packetStates: packetStates,
  types: types,
  states: states,
  get: get,
  debug: debug,
  evalCondition:evalCondition
};
