'use strict'

const Client = require('./client')
const assert = require('assert')

const encrypt = require('./client/encrypt')
const keepalive = require('./client/keepalive')
const compress = require('./client/compress')
const auth = require('./client/mojangAuth')
const microsoftAuth = require('./client/microsoftAuth')
const setProtocol = require('./client/setProtocol')
const play = require('./client/play')
const tcpDns = require('./client/tcp_dns')
const autoVersion = require('./client/autoVersion')
const pluginChannels = require('./client/pluginChannels')
const versionChecking = require('./client/versionChecking')

module.exports = createClient

function createClient (options) {
  assert.ok(options, 'Options is required')
  assert.ok(options.username, 'Username is required')
  if (!options.version) { options.version = false }

  // TODO: Avoid setting default version if autoVersion is enabled
  const optVersion = options.version || require('./version').defaultVersion
  const mcData = require('minecraft-data')(optVersion)
  if (!mcData) throw new Error(`Unsupported protocol version: ${optVersion}`)
  const version = mcData.version
  options.majorVersion = version.majorVersion
  options.protocolVersion = version.version
  const hideErrors = options.hideErrors || false

  const client = new Client(false, version.minecraftVersion, options.customPackets, hideErrors)

  tcpDns(client, options)
  if (options.auth instanceof Function) {
    options.auth(client, options)
  } else {
    switch (options.auth) {
      case 'mojang':
        console.warn('[deprecated] Mojang auth servers no longer accept Mojang accounts to login. Convert your account.\nhttps://help.minecraft.net/hc/en-us/articles/4403181904525-How-to-Migrate-Your-Mojang-Account-to-a-Microsoft-Account')
        auth(client, options)
        break
      case 'microsoft':
        microsoftAuth.authenticate(client, options).catch((err) => client.emit('error', err))
        break
      default:
        client.username = options.username
        options.connect(client)
        break
    }
  }
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
