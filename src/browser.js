var readPackets = require("./packets").readPackets;
var utils = require("./utils");
var serializer = require("./transforms/serializer");

module.exports = {
  Client: require('./client'),
  protocol: require('./protocol'),
  types: serializer.types,
  get: serializer.get,
  readPackets:readPackets,
  supportedVersions:require("./version").supportedVersions
};
