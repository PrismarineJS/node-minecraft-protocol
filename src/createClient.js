'use strict'

const Client = require('./client')
const assert = require('assert')

const encrypt = require('./client/encrypt')
const keepalive = require('./client/keepalive')
const compress = require('./client/compress')
const auth = require('./client/auth')
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
  if (!options.version) { options.version = false }

  const defaultVersion = require('./version').defaultVersion
  const optVersion = options.version || (() => {
    const optVersionClient = new Client(false, defaultVersion)
    const returnClient = autoVersion(optVersionClient, options)
    optVersionClient.end()
    const returnVal = returnClient.version
    returnClient.end() // TODO: improve this in the future
    return returnVal
  }) ()

  const mcData = require('minecraft-data')(optVersion)
  if (!mcData) throw new Error(`unsupported protocol version: ${optVersion}`)
  const version = mcData.version
  options.majorVersion = version.majorVersion
  options.protocolVersion = version.version
  const hideErrors = options.hideErrors || false

  const client = new Client(false, version.minecraftVersion, options.customPackets, hideErrors)

  tcpDns(client, options)
  if (options.auth === 'microsoft') {
    if (options.password) {
      microsoftAuth.authenticatePassword(client, options)
    } else {
      microsoftAuth.authenticateDeviceCode(client, options)
    }
  } else {
    auth(client, options)
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
