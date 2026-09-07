const mc = require('minecraft-protocol')

// MC_VERSION names the one supported version to test; unset tests all of them.
const only = process.env.MC_VERSION

if (only && !mc.supportedVersions.includes(only)) {
  throw new Error(`MC_VERSION is ${only}, which is not one of ${mc.supportedVersions.join(', ')}`)
}

module.exports = only ? [only] : mc.supportedVersions
