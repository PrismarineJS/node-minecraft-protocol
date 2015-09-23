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
function createPacketBuffer(packetName, state, params, isServer) {
  var direction = !isServer ? 'toServer' : 'toClient';
  var packetId = packetIds[state][direction][packetName];
  assert.notEqual(packetId, undefined, `${state}.${isServer}.${packetName} : ${packetId}`);
  var packet = get(packetName, state, !isServer);
  assert.notEqual(packet, null);

  var length = utils.varint[2](packetId);
  tryCatch(() => {
    length += structures.container[2].call(proto, params, packet, {});
    //length += proto.sizeOf(params, ["container", packet], {});
  }, (e) => {
    e.field = [state, direction, packetName, e.field].join(".");
    e.message = `SizeOf error for ${e.field} : ${e.message}`;
    throw e;
  });

  var buffer = new Buffer(length);
  var offset = utils.varint[1](packetId, buffer, 0);
  tryCatch(() => {
    offset = structures.container[1].call(proto, params, buffer, offset, packet, {});
    //offset = proto.write(params, buffer, offset, ["container", packet], {});
  }, (e) => {
    e.field = [state, direction, packetName, e.field].join(".");
    e.message = `Write error for ${e.field} : ${e.message}`;
    throw e;
  });
  return buffer;
}


function get(packetName, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packetFields[state][direction][packetName];
  if(!packetInfo) {
    return null;
  }
  return packetInfo;
}

function parsePacketData(buffer, state, isServer, packetsToParse = {"packet": true}) {
  var { value: packetId, size: cursor } = utils.varint[0](buffer, 0);

  var direction = isServer ? "toServer" : "toClient";
  var packetName = packetNames[state][direction][packetId];
  var results = {
    metadata: {
      name: packetName,
      id: packetId,
      state
    },
    data: {},
    buffer
  };

  // Only parse the packet if there is a need for it, AKA if there is a listener
  // attached to it.
  var shouldParse =
    (packetsToParse.hasOwnProperty(packetName) && packetsToParse[packetName] > 0) ||
    (packetsToParse.hasOwnProperty("packet") && packetsToParse["packet"] > 0);
  if (!shouldParse)
    return results;

  var packetInfo = get(packetName, state, isServer);
  if(packetInfo === null)
    throw new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")")
  else
    debug("read packetId " + state + "." + packetName + " (0x" + packetId.toString(16) + ")");

  var res;
  tryCatch(() => {
    res = proto.read(buffer, cursor, ["container", packetInfo], {});
  }, (e) => {
    e.field = [state, direction, packetName, e.field].join(".");
    e.message = `Read error for ${e.field} : ${e.message}`;
    throw e;
  });
  results.data = res.value;
  cursor += res.size;
  if(buffer.length > cursor)
    throw new Error(`Read error for ${packetName} : Packet data not entirely read :
        ${JSON.stringify(results)}`);
  debug(results);
  return results;
}

class Serializer extends Transform {
  constructor({ state = states.HANDSHAKING, isServer = false } = {}) {
    super({ writableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
  }

  _transform(chunk, enc, cb) {
    try {
      var buf = createPacketBuffer(chunk.packetName, this.protocolState, chunk.params, this.isServer);
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
    this.push(packet);
    return cb();
  }
}
