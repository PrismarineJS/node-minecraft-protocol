var assert = require('assert');
var util = require('util');
var zlib = require('zlib');

var getField= require("./utils").getField;

var STRING_MAX_LENGTH = 240;

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
};

var packets=require("../protocol/protocol");

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

var numeric=require("./datatypes/numeric");
var utils=require("./datatypes/utils");
var minecraft=require("./datatypes/minecraft");
var structures=require("./datatypes/structures");

var types = {
  'byte': numeric.byte,
  'ubyte':numeric.ubyte,
  'short': numeric.short,
  'ushort': numeric.ushort,
  'int': numeric.int,
  'long': numeric.long,
  'varint': utils.varint,
  'float': numeric.float,
  'double': numeric.double,
  'bool': utils.bool,
  'string': utils.string,
  'ustring': utils.ustring,
  'container': structures.container,
  'array':structures.array,
  'buffer': utils.buffer,
  'count': structures.count,
  'condition': [readCondition, writeCondition, sizeOfCondition],
  // TODO : remove type-specific, replace with generic containers and arrays.
  'restBuffer': minecraft.restBuffer,
  'UUID': minecraft.UUID,
  'position': minecraft.position,
  'slot': minecraft.slot,
  'nbt': minecraft.nbt,
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata]
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

function readCondition(buffer,offset,typeArgs, rootNode)
{
    if(!evalCondition(typeArgs,rootNode))
        return { value: null, size: 0 };
    return proto.read(buffer, offset, { type: typeArgs.type, typeArgs:typeArgs.typeArgs }, rootNode);
}

function writeCondition(value, buffer, offset, typeArgs, rootNode) {
    if(!evalCondition(typeArgs,rootNode))
        return offset;

    return proto.write(value, buffer, offset, { type: typeArgs.type, typeArgs:typeArgs.typeArgs  }, rootNode);
}

function sizeOfCondition(value, fieldInfo, rootNode) {
    if(!evalCondition(fieldInfo,rootNode))
        return 0;

    return proto.sizeOf(value,fieldInfo, rootNode);
}


function evalCondition(condition,field_values)
{
    var field_value_to_test="this" in condition && condition["this"] ? field_values["this"][condition.field] : field_values[condition.field];
    var b=condition.values.some(function(value) {return field_value_to_test===value;});
    if("different" in condition && condition["different"])
        return !b;
    else
        return b;
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
        results = proto.read(buffer, cursor, dataType, {});
        if (! results) return null;
        metadata.push({
            key: key,
            value: results.value,
            type: typeName,
        });
        cursor += results.size;
    }
}



function writeEntityMetadata(value, buffer, offset) {
    value.forEach(function(item) {
        var type = entityMetadataTypeBytes[item.type];
        var headerByte = (type << 5) | item.key;
        buffer.writeUInt8(headerByte, offset);
        offset += 1;
        offset = proto.write(item.value, buffer, offset, entityMetadataTypes[type], {});
    });
    buffer.writeUInt8(0x7f, offset);
    return offset + 1;
}



function sizeOfEntityMetadata(value) {
    var size = 1 + value.length;
    var item;
    for (var i = 0; i < value.length; ++i) {
        item = value[i];
        size += proto.sizeOf(item.value, entityMetadataTypes[entityMetadataTypeBytes[item.type]], {});
    }
    return size;
}



function NMProtocols()
{

}

NMProtocols.prototype.read = function(buffer, cursor, fieldInfo, rootNodes) {
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  var readResults = type[0].call(this,buffer, cursor, fieldInfo.typeArgs, rootNodes);
  if (readResults == null) {
    throw new Error("Reader returned null : " + JSON.stringify(fieldInfo));
  }
  if (readResults && readResults.error) return { error: readResults.error };
  return readResults;
};

NMProtocols.prototype.write = function(value, buffer, offset, fieldInfo, rootNode) {
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  return type[1].call(this,value, buffer, offset, fieldInfo.typeArgs, rootNode);
};

NMProtocols.prototype.sizeOf = function(value, fieldInfo, rootNode) {
  var type = types[fieldInfo.type];
  if (!type) {
    throw new Error("missing data type: " + fieldInfo.type);
  }
  if (typeof type[2] === 'function') {
    return type[2].call(this,value, fieldInfo.typeArgs, rootNode);
  } else {
    return type[2];
  }
};

var proto=new NMProtocols();

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
    length += proto.sizeOf(params[fieldInfo.name], fieldInfo, params);
    } catch (e) {
      console.log("fieldInfo : " + JSON.stringify(fieldInfo));
      console.log("params : " + JSON.stringify(params));
      throw e;
    }
  });
  length += utils.varint[2](packetId);
  var size = length;// + utils.varint[2](length);
  var buffer = new Buffer(size);
  var offset = 0;//utils.varint[1](length, buffer, 0);
  offset = utils.varint[1](packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    // TODO : A better check is probably needed
    if(typeof value === "undefined" && fieldInfo.type != "count" && (fieldInfo.type !="condition" || evalCondition(fieldInfo.typeArgs,params)))
      debug(new Error("Missing Property " + fieldInfo.name).stack);
    offset = proto.write(value, buffer, offset, fieldInfo, params);
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
  var packet = new Buffer(utils.varint[2](buffer.length) + buffer.length);
  var cursor = utils.varint[1](buffer.length, packet, 0);
  utils.buffer[1](buffer, packet, cursor);
  callback(null, packet);
}

function newStylePacket(buffer, callback) {
  var sizeOfDataLength = utils.varint[2](0);
  var sizeOfLength = utils.varint[2](buffer.length + sizeOfDataLength);
  var size = sizeOfLength + sizeOfDataLength + buffer.length;
  var packet = new Buffer(size);
  var cursor = utils.varint[1](size - sizeOfLength, packet, 0);
  cursor = utils.varint[1](0, packet, cursor);
  utils.buffer[1](buffer, packet, cursor);
  callback(null, packet);
}

function parsePacketData(buffer, state, isServer, packetsToParse) {
  var cursor = 0;
  var packetIdField = utils.varint[0](buffer, cursor);
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
    readResults = proto.read(buffer, cursor, fieldInfo, results);
    /* A deserializer cannot return null anymore. Besides, proto.read() returns
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
    if (readResults === null || readResults.value==null) continue;
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
  var lengthField = utils.varint[0](buffer, 0);
  if (!!!lengthField) return null;
  var length = lengthField.value;
  cursor += lengthField.size;
  if (length + lengthField.size > buffer.length) return null; // fail early
  var result = parsePacketData(buffer.slice(cursor, length + cursor), state, isServer, packetsToParse);
  result.size = lengthField.size + length;
  return result;
}

function parseNewStylePacket(buffer, state, isServer, packetsToParse, cb) {
  var dataLengthField = utils.varint[0](buffer, 0);
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
