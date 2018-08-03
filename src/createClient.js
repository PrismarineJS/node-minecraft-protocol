'use strict'

const Client = require('./client')
const assert = require('assert')

const encrypt = require('./client/encrypt')
const keepalive = require('./client/keepalive')
const compress = require('./client/compress')
const auth = require('./client/auth')
const setProtocol = require('./client/setProtocol')
const play = require('./client/play')
const tcpDns = require('./client/tcp_dns')
const autoVersion = require('./client/autoVersion')
const pluginChannels = require('./client/pluginChannels')
const versionChecking = require('./client/versionChecking')

module.exports = createClient

function createClient (options) {
  assert.ok(options, 'options is required')
  assert.ok(options.username, 'username is required')
  if (!options.version) { options.version = false }

  // TODO: avoid setting default version if autoVersion is enabled
  const optVersion = options.version || require('./version').defaultVersion
  const mcData = require('minecraft-data')(optVersion)
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`)
  const version = mcData.version
  options.majorVersion = version.majorVersion
  options.protocolVersion = version.version
  const hideErrors = options.hideErrors || false

  const client = new Client(false, version.minecraftVersion, options.customPackets, hideErrors)

  tcpDns(client, options)
  auth(client, options)
  if (options.version === false) autoVersion(client, options)
  setProtocol(client, options)
  keepalive(client, options)
  encrypt(client, options)
  play(client, options)
  compress(client, options)
  pluginChannels(client, options)
  versionChecking(client, options)

  return client
}
