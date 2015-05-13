var assert = require('assert');
var zlib = require('zlib');

var evalCondition = require("./utils").evalCondition;
var readPackets = require("./packets").readPackets;
var debug = require("./debug");


// This is really just for the client.
var states = {
    "HANDSHAKING": "handshaking",
    "STATUS": "status",
    "LOGIN": "login",
    "PLAY": "play"
};
var packets=require("../protocol/protocol");
var packetIndexes=readPackets(packets,states);

var packetFields = packetIndexes.packetFields;
var packetNames = packetIndexes.packetNames;
var packetIds = packetIndexes.packetIds;
var packetStates = packetIndexes.packetStates;

function NMProtocols()
{
  this.types={};
}

NMProtocols.prototype.addType = function(name,functions)
{
    this.types[name]=functions;
};

NMProtocols.prototype.addTypes = function(types)
{
    var self=this;
    Object.keys(types).forEach(function(name){
       self.addType(name,types[name]);
    });
};

NMProtocols.prototype.read = function(buffer, cursor, fieldInfo, rootNodes) {
  var type = this.types[fieldInfo.type];
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
  var type = this.types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  return type[1].call(this,value, buffer, offset, fieldInfo.typeArgs, rootNode);
};

NMProtocols.prototype.sizeOf = function(value, fieldInfo, rootNode) {
  var type = this.types[fieldInfo.type];
  if (!type) {
    throw new Error("missing data type: " + fieldInfo.type);
  }
  if (typeof type[2] === 'function') {
    return type[2].call(this,value, fieldInfo.typeArgs, rootNode);
  } else {
    return type[2];
  }
};


var numeric=require("./datatypes/numeric");
var utils=require("./datatypes/utils");
var minecraft=require("./datatypes/minecraft");
var structures=require("./datatypes/structures");
var conditional=require("./datatypes/conditional");

var proto=new NMProtocols();
proto.addTypes(numeric);
proto.addTypes(utils);
proto.addTypes(minecraft);
proto.addTypes(structures);
proto.addTypes(conditional);

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
  parsePacketData: parsePacketData,
  parseNewStylePacket: parseNewStylePacket,
  createPacketBuffer: createPacketBuffer,
  compressPacketBuffer: compressPacketBuffer,
  oldStylePacket: oldStylePacket,
  newStylePacket: newStylePacket,
  packetIds: packetIds,
  packetNames: packetNames,
  packetFields: packetFields,
  packetStates: packetStates,
  types: proto.types,
  states: states,
  get: get,
  evalCondition:evalCondition
};
