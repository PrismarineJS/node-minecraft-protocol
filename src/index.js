var Client = require('./client');
var Server = require('./server');
var Yggdrasil = require('./yggdrasil.js');
var serializer = require("./transforms/serializer");
var utils = require("./utils");
var version = require("./version");
var packets = require('minecraft-data')(version.majorVersion).protocol;
var readPackets = require("./packets").readPackets;
var packetIndexes = readPackets(packets, serializer.states);
var createClient = require("./createClient");
var createServer = require("./createServer");

module.exports = {
  createClient: createClient,
  createServer: createServer,
  Client: Client,
  Server: Server,
  states: serializer.states,
  createPacketBuffer: serializer.createPacketBuffer,
  parsePacketData: serializer.parsePacketData,
  packetFields: packetIndexes.packetFields,
  packetNames: packetIndexes.packetNames,
  packetIds: packetIndexes.packetIds,
  packetStates: packetIndexes.packetStates,
  types: serializer.types,
  get: serializer.get,
  evalCondition: utils.evalCondition,
  ping: require('./ping'),
  yggdrasil: Yggdrasil,
  version: version.version,
  minecraftVersion: version.minecraftVersion
};
