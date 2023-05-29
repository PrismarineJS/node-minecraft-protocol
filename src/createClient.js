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
  assert.ok(options, 'options is required')
  assert.ok(options.username, 'username is required')
  if (!options.version && !options.realms) { options.version = false }
  if (options.realms && options.auth !== 'microsoft') throw new Error('Currently Realms can only be joined with auth: "microsoft"')

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
  if (options.auth instanceof Function) {
    options.auth(client, options)
  } else {
    switch (options.auth) {
      case 'mojang':
        console.warn('[deprecated] mojang auth servers no longer accept mojang accounts to login. convert your account.\nhttps://help.minecraft.net/hc/en-us/articles/4403181904525-How-to-Migrate-Your-Mojang-Account-to-a-Microsoft-Account')
        auth(client, options)
        break
      case 'microsoft':
        if (options.realms) {
          microsoftAuth.realmAuthenticate(client, options).then(() => microsoftAuth.authenticate(client, options)).catch((err) => client.emit('error', err))
        } else {
          microsoftAuth.authenticate(client, options).catch((err) => client.emit('error', err))
        }
        break
      case 'offline':
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
