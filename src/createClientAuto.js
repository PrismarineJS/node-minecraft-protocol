'use strict';

var ping = require('./ping');
var assert = require('assert');
var debug = require('./debug');
var createClient = require('./createClient');

// see http://wiki.vg/Protocol_version_numbers
// Get the minecraft-data version string for a protocol version
// TODO: switch to using https://github.com/PrismarineJS/minecraft-data/pull/92
function protocol2version(n) {
  if (n >= 48) return '1.9'; // 1.9 snapshots (15w+), 16w03a is 96
  if (n >= 6 && n <= 47) return '1.8.9'; // including 1.8 snapshots (14w)
  if (n >= 4 && n <= 5) return '1.7.10'; // including 1.7 prereleases
  // TODO: earlier versions "Beginning with the 1.7.1 pre-release (and release 1.7.2), versioning was reset."
  throw new Error(`unsupported/unknown protocol version: ${versionProtocol}, update protocol2version`);
}

function createClientAsync(options, cb) {
  assert.ok(options, 'options is required');

  debug('pinging',options.host);
  // TODO: refactor with DNS SRV lookup in NMP
  // TODO: detect ping timeout, https://github.com/PrismarineJS/node-minecraft-protocol/issues/329
  ping(options, function(err, response) {
    var client;

    if (err) return cb(err, null);
    debug('ping response',response);
    // TODO: could also use ping pre-connect to save description, type, negotiate protocol etc.
    //  ^ see https://github.com/PrismarineJS/node-minecraft-protocol/issues/327
    var motd = response.description;
    debug('Server description:',motd); // TODO: save

    // Pass server-reported version to protocol handler
    // The version string is interpereted by https://github.com/PrismarineJS/node-minecraft-data
    var versionName = response.version.name;        // 1.8.9, 1.7.10
    var versionProtocol = response.version.protocol;//    47,      5

    debug(`Server version: ${versionName}, protocol: ${versionProtocol}`);
    // Note that versionName is a descriptive version stirng like '1.8.9' on vailla, but other
    // servers add their own name (Spigot 1.8.8, Glowstone++ 1.8.9) so we cannot use it directly,
    // even though it is in a format accepted by minecraft-data. Instead, translate the protocol.
    options.version = protocol2version(versionProtocol);

    // Use the exact same protocol version
    // Requires https://github.com/PrismarineJS/node-minecraft-protocol/pull/330
    options.protocolVersion = versionProtocol;

    if (response.modinfo && response.modinfo.type === 'FML') {
      // Use the list of Forge mods from the server ping, so client will match server
      var forgeMods = response.modinfo.modList;
      debug('Using forgeMods:',forgeMods);
      // TODO: https://github.com/PrismarineJS/node-minecraft-protocol/issues/114
      //  https://github.com/PrismarineJS/node-minecraft-protocol/pull/326
      throw new Error('FML/Forge not yet supported');
    } else {
      client = createClient(options); // vanilla
    }
    cb(null, client);
  });
}

module.exports = createClientAsync;
