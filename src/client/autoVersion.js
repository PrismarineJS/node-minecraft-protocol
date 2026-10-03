'use strict'

const ping = require('../ping')
const debug = require('debug')('minecraft-protocol')
const states = require('../states')
const minecraftData = require('minecraft-data')

module.exports = function (client, options) {
  client.wait_connect = true // don't let src/client/setProtocol proceed on socket 'connect' until 'connect_allowed'
  debug('pinging', options.host)
  // TODO: use 0xfe ping instead for better compatibility/performance? https://github.com/deathcap/node-minecraft-ping
  ping(options, function (err, response) {
    if (err) { return client.emit('error', err) }
    debug('ping response', response)
    // TODO: could also use ping pre-connect to save description, type, max players, etc.
    const motd = response.description
    debug('Server description:', motd) // TODO: save

    // Pass server-reported version to protocol handler
    // The version string is interpreted by https://github.com/PrismarineJS/node-minecraft-data
    const brandedMinecraftVersion = response.version.name // 1.8.9, 1.7.10
    const protocolVersion = response.version.protocol//    47,      5
    const minecraftVersion = chooseVersion(minecraftData, brandedMinecraftVersion, protocolVersion)
    if (!minecraftVersion) {
      return client.emit('error', new Error(`Unsupported protocol version '${protocolVersion}' (server reported '${brandedMinecraftVersion}'); the server may be newer than your installed minecraft-data - try updating your packages with 'npm update'`))
    }

    debug(`Server version: ${minecraftVersion}, protocol: ${protocolVersion}`)

    options.version = minecraftVersion
    options.protocolVersion = protocolVersion

    // Reinitialize client object with new version TODO: move out of its constructor?
    client.version = minecraftVersion
    client.state = states.HANDSHAKING

    // Let other plugins such as Forge/FML (modinfo) respond to the ping response
    if (client.autoVersionHooks) {
      client.autoVersionHooks.forEach((hook) => {
        hook(response, client, options)
      })
    }

    // Finished configuring client object, let connection proceed
    client.emit('connect_allowed')
    client.wait_connect = false
  })
  return client
}

// Resolve a Minecraft version from a server's ping (version.name + version.protocol). A protocol number maps to MANY versions
// (a release plus its snapshots and patch releases), so taking the first candidate frequently returned the wrong version and
// could return a snapshot for a plain release. Instead: prefer the protocol candidate matching the server-reported name; else
// the newest RELEASE among the candidates (never a snapshot); else, when the protocol is unknown (installed minecraft-data
// older than the server, or a proxy sending protocol -1/0), fall back to the name; else null (a clear error, not a bogus pick).
function chooseVersion (minecraftData, name, protocol) {
  const guessFromName = [name]
    .concat((name || '').match(/((\d+\.)+\d+)/g) || [])
    .map(function (v) { return minecraftData.versionsByMinecraftVersion.pc[v] })
    .filter(function (info) { return info })
    .sort(function (a, b) { return b.version - a.version })
  const nameTop = guessFromName.length ? guessFromName[0].minecraftVersion : null
  const isReleaseName = function (v) { return typeof v === 'string' && /^\d+\.\d+(\.\d+)?$/.test(v) && !/(\d+w\d+[a-z])|pre|rc|snapshot|experimental/i.test(v) }
  const protoCandidates = (Number.isInteger(protocol) && protocol > 0)
    ? (minecraftData.postNettyVersionsByProtocolVersion.pc[protocol] || [])
    : []
  if (protoCandidates.length) {
    if (nameTop && protoCandidates.some(function (info) { return info.minecraftVersion === nameTop })) return nameTop
    const rel = protoCandidates.find(function (info) { return isReleaseName(info.minecraftVersion) })
    return rel ? rel.minecraftVersion : protoCandidates[0].minecraftVersion
  }
  return nameTop // unknown/absent/invalid protocol: trust the name, or null if it too is unresolvable
}

module.exports.chooseVersion = chooseVersion
