const ping = require('../ping');
const debug = require('../debug');
const states = require('../states');
const assert = require('assert');
const minecraft_data = require('minecraft-data');

module.exports = function(client, options) {
  client.wait_connect = true; // don't let src/client/setProtocol proceed on socket 'connect' until 'connect_allowed'
  debug('pinging',options.host);
  const pingOptions = {host: options.host, port: options.port};
  // TODO: use 0xfe ping instead for better compatibility/performance? https://github.com/deathcap/node-minecraft-ping
  ping(pingOptions, function(err, response) {
    if (err) throw err; // hmm
    debug('ping response',response);
    // TODO: could also use ping pre-connect to save description, type, max players, etc.
    const motd = response.description;
    debug('Server description:',motd); // TODO: save

    // Pass server-reported version to protocol handler
    // The version string is interpereted by https://github.com/PrismarineJS/node-minecraft-data
    const minecraftVersion = response.version.name;        // 1.8.9, 1.7.10
    const protocolVersion = response.version.protocol;//    47,      5

    debug(`Server version: ${minecraftVersion}, protocol: ${protocolVersion}`);
    // Note that versionName is a descriptive version stirng like '1.8.9' on vailla, but other
    // servers add their own name (Spigot 1.8.8, Glowstone++ 1.8.9) so we cannot use it directly,
    // even though it is in a format accepted by minecraft-data. Instead, translate the protocol.
    // TODO: pre-Netty version support (uses overlapping version numbers, so would have to check versionName)
    const versionInfos = minecraft_data.postNettyVersionsByProtocolVersion[protocolVersion];
    if (!versionInfos && versionInfos.length < 1) throw new Error(`unsupported/unknown protocol version: ${protocolVersion}, update minecraft-data`);
    const versionInfo = versionInfos[0]; // use newest
    options.version = versionInfo.minecraftVersion;
    options.protocolVersion = protocolVersion;

    // Reinitialize client object with new version TODO: move out of its constructor?
    client.version = versionInfo.majorVersion;
    client.state = states.HANDSHAKING;

    // Let other plugins such as Forge/FML (modinfo) respond to the ping response
    if (client.autoVersionHooks) {
      client.autoVersionHooks.forEach((hook) => {
        hook(response, client, options);
      });
    }

    // Finished configuring client object, let connection proceed
    client.emit('connect_allowed');
  });
  return client;
};
