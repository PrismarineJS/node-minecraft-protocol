'use strict';

const Client = require('./client');
const assert = require('assert');

const encrypt = require('./client/encrypt');
const keepalive = require('./client/keepalive');
const compress = require('./client/compress');
const caseCorrect = require('./client/caseCorrect');
const setProtocol = require('./client/setProtocol');
const play = require('./client/play');
const tcp_dns = require('./client/tcp_dns');
const autoVersion = require('./client/autoVersion');

module.exports=createClient;

function createClient(options) {
  assert.ok(options, "options is required");
  assert.ok(options.username, "username is required");

  // TODO: avoid setting default version if autoVersion is enabled
  const optVersion = options.version || require("./version").defaultVersion;
  const mcData=require("minecraft-data")(optVersion);
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`);
  const version = mcData.version;
  options.majorVersion = version.majorVersion;
  options.protocolVersion = version.version;

  const client = new Client(false, version.minecraftVersion,options.customPackets);

  tcp_dns(client, options);
  caseCorrect(client, options);
  if (options.version === false) autoVersion(client, options);
  setProtocol(client, options);
  keepalive(client, options);
  encrypt(client, options);
  play(client, options);
  compress(client, options);

  return client;
}
