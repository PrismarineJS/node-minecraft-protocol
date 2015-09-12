var [readVarInt, writeVarInt, sizeOfVarInt] = require("../datatypes/utils").varint;
var protocol = require("../protocol");
var Transform = require("readable-stream").Transform;
var debug = require("../debug");
var assert = require('assert');
var { getFieldInfo, tryCatch, addErrorField } = require('../utils');

module.exports.createSerializer = function(obj) {
  return new Serializer(obj);
};

module.exports.createDeserializer = function(obj) {
  return new Deserializer(obj);
};

module.exports.createPacketBuffer=createPacketBuffer;
module.exports.parsePacketData=parsePacketData;

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
};
module.exports.states = states;

module.exports.get = get;



var NMProtocols = require("../protocol");

var numeric = require("../datatypes/numeric");
var utils = require("../datatypes/utils");
var minecraft = require("../datatypes/minecraft");
var structures = require("../datatypes/structures");
var conditional = require("../datatypes/conditional");

var proto = new NMProtocols();
proto.addTypes(numeric);
proto.addTypes(utils);
proto.addTypes(minecraft);
proto.addTypes(structures);
proto.addTypes(conditional);

module.exports.types = proto.types;

var version = require('../version');
var packets = require('minecraft-data')(version.majorVersion).protocol;
proto.addTypes(packets.types);

var readPackets = require("../packets").readPackets;
var packetIndexes = readPackets(packets.states, states);

var packetFields = packetIndexes.packetFields;
var packetNames = packetIndexes.packetNames;
var packetIds = packetIndexes.packetIds;
var packetStates = packetIndexes.packetStates;


// TODO : This does NOT contain the length prefix anymore.
function createPacketBuffer(packetId, state, params, isServer) {
  var length = 0;
  if(typeof packetId === 'string' && typeof state !== 'string' && !params) {
    // simplified two-argument usage, createPacketBuffer(name, params)
    params = state;
    state = packetStates[!isServer ? 'toServer' : 'toClient'][packetId];
  }
  if(typeof packetId === 'string') packetId = packetIds[state][!isServer ? 'toServer' : 'toClient'][packetId];
  assert.notEqual(packetId, undefined);

  var packet = get(packetId, state, !isServer);
  var packetName = packetNames[state][!isServer ? 'toServer' : 'toClient'][packetId];
  assert.notEqual(packet, null);
  packet.forEach(function(fieldInfo) {
    tryCatch(() => {
      length += proto.sizeOf(params[fieldInfo.name], fieldInfo.type, params);
    }, (e) => {
      addErrorField(e, fieldInfo.name);
      e.message = "sizeOf error for " + packetName + "." + e.field + " : " + e.message;
      throw e;
    });
  });
  length += utils.varint[2](packetId);
  var size = length;// + utils.varint[2](length);
  var buffer = new Buffer(size);
  var offset = 0;//utils.varint[1](length, buffer, 0);
  offset = utils.varint[1](packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    // TODO : This check belongs to the respective datatype.
    if(typeof value === "undefined" && fieldInfo.type != "count")
      debug(new Error("Missing Property " + fieldInfo.name).stack);
    tryCatch(() => {
      offset = proto.write(value, buffer, offset, fieldInfo.type, params);
    }, (e) => {
      e.message = "Write error for " + packetName + "." + e.field + " : " + e.message;
      throw e;
    });
  });
  return buffer;
}


function get(packetId, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packetFields[state][direction][packetId];
  if(!packetInfo) {
    return null;
  }
  return packetInfo;
}


// By default, parse every packets.
function parsePacketData(buffer, state, isServer, packetsToParse = {"packet": true}) {
  var cursor = 0;
  var { value: packetId, size: cursor } = utils.varint[0](buffer, cursor);

  var results = {id: packetId, state: state};
  // Only parse the packet if there is a need for it, AKA if there is a listener attached to it
  var name = packetNames[state][isServer ? "toServer" : "toClient"][packetId];
  var shouldParse = (!packetsToParse.hasOwnProperty(name) || packetsToParse[name] <= 0)
    && (!packetsToParse.hasOwnProperty("packet") || packetsToParse["packet"] <= 0);
  if(shouldParse) {
    return {
      buffer: buffer,
      results: results
    };
  }

  var packetInfo = get(packetId, state, isServer);
  if(packetInfo === null) {
    throw new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")")
  } else {
    var packetName = packetNames[state][isServer ? "toServer" : "toClient"][packetId];
    debug("read packetId " + state + "." + packetName + " (0x" + packetId.toString(16) + ")");
  }

  var packetName = packetNames[state][!isServer ? 'toClient' : 'toServer'][packetId];
  var i, fieldInfo, readResults;
  for(i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    tryCatch(() => {
      readResults = proto.read(buffer, cursor, fieldInfo.type, results);
    }, (e) => {
      e.message = "Read error for " + packetName + "." + e.field + " : " + e.message;
      throw e;
    });
    if(readResults === null)
      throw new Error("A reader returned null. This is _not_ normal");
    if(readResults.error)
      throw new Error("A reader returned an error using the old method.");
    if (readResults.value != null)
      results[fieldInfo.name] = readResults.value;
    cursor += readResults.size;
  }
  if(buffer.length > cursor)
    throw new Error("Packet data not entirely read");
  debug(results);
  return {
    results: results,
    buffer: buffer
  };
}

class Serializer extends Transform {
  constructor({ state = states.HANDSHAKING, isServer = false } = {}) {
    super({ writableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
  }

  // TODO : Might make sense to make createPacketBuffer async.
  _transform(chunk, enc, cb) {
    try {
      var buf = createPacketBuffer(chunk.packetId, this.protocolState, chunk.params, this.isServer);
      this.push(buf);
      return cb();
    } catch (e) {
      return cb(e);
    }
  }
}

class Deserializer extends Transform {
  constructor({ state = states.HANDSHAKING, isServer = false, packetsToParse = {"packet": true} } = {}) {
    super({ readableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
    this.packetsToParse = packetsToParse;
  }

  _transform(chunk, enc, cb) {
    var packet;
    try {
      packet = parsePacketData(chunk, this.protocolState, this.isServer, this.packetsToParse);
    } catch (e) {
      return cb(e);
    }
    if (packet.error)
    {
      packet.error.packet = packet;
      return cb(packet.error)
    }
    else
    {
      this.push(packet);
      return cb();
    }
  }
}
