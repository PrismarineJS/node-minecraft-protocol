import Client from './client';
import assert from 'assert';


import encrypt from './client/encrypt';
import keepalive from './client/keepalive';
import compress from './client/compress';
import caseCorrect from './client/caseCorrect';
import setProtocol from './client/setProtocol';
import play from './client/play';
import tcp_dns from './client/tcp_dns';
import autoVersion from './client/autoVersion';

export default createClient;

function createClient(options) {
  assert.ok(options, "options is required");
  assert.ok(options.username, "username is required");

  // TODO: avoid setting default version if autoVersion is enabled
  const optVersion = options.version || require("./version").defaultVersion;
  const mcData=require("minecraft-data")(optVersion);
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`);
  const { version } = mcData;
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
