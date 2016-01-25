var Client = require('./client');
var Server = require('./server');
var serializer = require("./transforms/serializer");
var createClient = require("./createClient");
var createClientAuto = require("./createClientAuto");
var createServer = require("./createServer");

module.exports = {
  createClient: createClient,
  createClientAuto: createClientAuto,
  createServer: createServer,
  Client: Client,
  Server: Server,
  states: require("./states"),
  createSerializer:serializer.createSerializer,
  createDeserializer:serializer.createDeserializer,
  ping: require('./ping'),
  supportedVersions:require("./version").supportedVersions
};
