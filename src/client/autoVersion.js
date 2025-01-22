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
    const guessFromName = [brandedMinecraftVersion]
      .concat(brandedMinecraftVersion.match(/((\d+\.)+\d+)/g) || [])
      .map(function (version) {
        return minecraftData.versionsByMinecraftVersion.pc[version]
      })
      .filter(function (info) { return info })
      .sort(function (a, b) { return b.version - a.version })
    const versions = (minecraftData.postNettyVersionsByProtocolVersion.pc[protocolVersion] || []).concat(guessFromName)
    if (versions.length === 0) {
      client.emit('error', new Error(`Unsupported protocol version '${protocolVersion}'; try updating your packages with 'npm update'`))
    }
    const minecraftVersion = versions[0].minecraftVersion

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
