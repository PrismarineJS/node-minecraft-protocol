'use strict';

const Client = require('./client');
const Server = require('./server');
const serializer = require("./transforms/serializer");
const createClient = require("./createClient");
const createServer = require("./createServer");

module.exports = {
  createClient: createClient,
  createServer: createServer,
  Client: Client,
  Server: Server,
  states: require("./states"),
  createSerializer:serializer.createSerializer,
  createDeserializer:serializer.createDeserializer,
  ping: require('./ping'),
  supportedVersions:require("./version").supportedVersions
};
