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

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
};
module.exports.states = states;

var NMProtocols = require("../protocol");
var numeric = require("../datatypes/numeric");
var utils = require("../datatypes/utils");
var minecraft = require("../datatypes/minecraft");
var structures = require("../datatypes/structures");
var conditional = require("../datatypes/conditional");
var readPackets = require("../packets").readPackets;


function createProtocol(types)
{
  var proto = new NMProtocols();
  proto.addTypes(numeric);
  proto.addTypes(utils);
  proto.addTypes(minecraft);
  proto.addTypes(structures);
  proto.addTypes(conditional);
  proto.addTypes(types);
  return proto;
}


class Serializer extends Transform {
  constructor({ state = states.HANDSHAKING, isServer = false , version} = {}) {
    super({ writableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
    this.version = version;

    var mcData=require("minecraft-data")(version);
    var packets = mcData.protocol.states;
    var packetIndexes = readPackets(packets, states);

    this.proto=createProtocol(mcData.protocol.types);

    this.packetFields = packetIndexes.packetFields;
    this.packetIds = packetIndexes.packetIds;
  }

  // TODO : This does NOT contain the length prefix anymore.
  createPacketBuffer(packetName, params) {
    var direction = !this.isServer ? 'toServer' : 'toClient';
    var packetId = this.packetIds[this.protocolState][direction][packetName];
    assert.notEqual(packetId, undefined, `${this.protocolState}.${direction}.${packetName} : ${packetId}`);
    var packet = this.packetFields[this.protocolState][direction][packetName];
    packet=packet ? packet : null;

    assert.notEqual(packet, null);

    var length = utils.varint[2](packetId);
    tryCatch(() => {
      length += structures.container[2].call(this.proto, params, packet, {});
      //length += proto.sizeOf(params, ["container", packet], {});
    }, (e) => {
      e.field = [this.protocolState, direction, packetName, e.field].join(".");
      e.message = `SizeOf error for ${e.field} : ${e.message}`;
      throw e;
    });

    var buffer = new Buffer(length);
    var offset = utils.varint[1](packetId, buffer, 0);
    tryCatch(() => {
      offset = structures.container[1].call(this.proto, params, buffer, offset, packet, {});
      //offset = proto.write(params, buffer, offset, ["container", packet], {});
    }, (e) => {
      e.field = [this.protocolState, direction, packetName, e.field].join(".");
      e.message = `Write error for ${e.field} : ${e.message}`;
      throw e;
    });
    return buffer;
  }

  _transform(chunk, enc, cb) {
    try {
      var buf = this.createPacketBuffer(chunk.packetName, chunk.params);
      this.push(buf);
      return cb();
    } catch (e) {
      return cb(e);
    }
  }
}

class Deserializer extends Transform {
  constructor({ state = states.HANDSHAKING, isServer = false, packetsToParse = {"packet": true}, version } = {}) {
    super({ readableObjectMode: true });
    this.protocolState = state;
    this.isServer = isServer;
    this.packetsToParse = packetsToParse;
    this.version = version;


    var mcData=require("minecraft-data")(version);
    var packets = mcData.protocol.states;
    var packetIndexes = readPackets(packets, states);

    this.proto=createProtocol(mcData.protocol.types);

    this.packetFields = packetIndexes.packetFields;
    this.packetNames = packetIndexes.packetNames;
  }

  parsePacketData(buffer) {
    var { value: packetId, size: cursor } = utils.varint[0](buffer, 0);

    var direction = this.isServer ? "toServer" : "toClient";
    var packetName = this.packetNames[this.protocolState][direction][packetId];
    var results = {
      metadata: {
        name: packetName,
        id: packetId,
        state:this.protocolState
      },
      data: {},
      buffer
    };

    // Only parse the packet if there is a need for it, AKA if there is a listener
    // attached to it.
    var shouldParse =
      (this.packetsToParse.hasOwnProperty(packetName) && this.packetsToParse[packetName] > 0) ||
      (this.packetsToParse.hasOwnProperty("packet") && this.packetsToParse["packet"] > 0);
    if (!shouldParse)
      return results;

    var packetInfo = this.packetFields[this.protocolState][direction][packetName];
    packetInfo=packetInfo ? packetInfo : null;
    if(packetInfo === null)
      throw new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")")
    else
      debug("read packetId " + this.protocolState + "." + packetName + " (0x" + packetId.toString(16) + ")");

    var res;
    tryCatch(() => {
      res = this.proto.read(buffer, cursor, ["container", packetInfo], {});
    }, (e) => {
      e.field = [this.protocolState, direction, packetName, e.field].join(".");
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


  _transform(chunk, enc, cb) {
    var packet;
    try {
      packet = this.parsePacketData(chunk);
    } catch (e) {
      return cb(e);
    }
    this.push(packet);
    return cb();
  }
}
