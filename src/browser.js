var version = require('./version');
var packets = require('minecraft-data')(version.majorVersion).protocol.states;
var readPackets = require("./packets").readPackets;
var packetIndexes = readPackets(packets, states);
var utils = require("./utils");
var serializer = require("./transforms/serializer");

module.exports = {
  Client: require('./client'),
  protocol: require('./protocol'),
  createPacketBuffer: serializer.createPacketBuffer,
  parsePacketData: serializer.parsePacketData,
  packetFields: packetIndexes.packetFields,
  packetNames: packetIndexes.packetNames,
  packetIds: packetIndexes.packetIds,
  packetStates: packetIndexes.packetStates,
  types: serializer.types,
  get: serializer.get,
};
