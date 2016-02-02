'use strict';

var ping = require('../ping');
var debug = require('../debug');
var states = require('../states');
var assert = require('assert');
var minecraft_data = require('minecraft-data');

module.exports = function(client, options) {
  options.wait_connect = true; // don't let src/client/setProtocol proceed on socket 'connect' until 'connect_allowed'
  debug('pinging',options.host);
  var pingOptions = {host: options.host, port: options.port};
  // TODO: use 0xfe ping instead for better compatibility/performance? https://github.com/deathcap/node-minecraft-ping
  ping(pingOptions, function(err, response) {
    if (err) throw err; // hmm
    debug('ping response',response);
    // TODO: could also use ping pre-connect to save description, type, max players, etc.
    var motd = response.description;
    debug('Server description:',motd); // TODO: save

    // Pass server-reported version to protocol handler
    // The version string is interpereted by https://github.com/PrismarineJS/node-minecraft-data
    var minecraftVersion = response.version.name;        // 1.8.9, 1.7.10
    var protocolVersion = response.version.protocol;//    47,      5

    debug(`Server version: ${minecraftVersion}, protocol: ${protocolVersion}`);
    // Note that versionName is a descriptive version stirng like '1.8.9' on vailla, but other
    // servers add their own name (Spigot 1.8.8, Glowstone++ 1.8.9) so we cannot use it directly,
    // even though it is in a format accepted by minecraft-data. Instead, translate the protocol.
    // TODO: pre-Netty version support (uses overlapping version numbers, so would have to check versionName)
    var versionInfos = minecraft_data.postNettyVersionsByProtocolVersion[protocolVersion];
    if (!versionInfos && versionInfos.length < 1) throw new Error(`unsupported/unknown protocol version: ${protocolVersion}, update minecraft-data`);
    var versionInfo = versionInfos[0]; // use newest
    options.version = versionInfo.minecraftVersion;
    options.protocolVersion = protocolVersion;

    // Reinitialize client object with new version TODO: move out of its constructor?
    client.version = versionInfo.majorVersion;
    client.state = states.HANDSHAKING;

    if (response.modinfo && response.modinfo.type === 'FML') {
      // Use the list of Forge mods from the server ping, so client will match server
      var forgeMods = response.modinfo.modList;
      debug('Using forgeMods:',forgeMods);
      // TODO: https://github.com/PrismarineJS/node-minecraft-protocol/issues/114
      //  https://github.com/PrismarineJS/node-minecraft-protocol/pull/326
      // TODO: modify client object to set forgeMods and enable forgeHandshake
      throw new Error('FML/Forge not yet supported');
    }
    // Finished configuring client object, let connection proceed
    client.emit('connect_allowed');
  });
  return client;
}
