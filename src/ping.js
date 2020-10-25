'use strict'

const Client = require('./client')
const states = require('./states')
const tcpDns = require('./client/tcp_dns')

module.exports = ping

function ping (options, cb) {
  options.host = options.host || 'localhost'
  options.port = options.port || 25565
  const optVersion = options.version || require('./version').defaultVersion
  const mcData = require('minecraft-data')(optVersion)
  const version = mcData.version
  options.majorVersion = version.majorVersion
  options.protocolVersion = version.version
  var closeTimer = null
  options.closeTimeout = options.closeTimeout || 120 * 1000
  options.noPongTimeout = options.noPongTimeout || 5 * 1000

  const client = new Client(false, version.minecraftVersion)
  client.on('error', function (err) {
    clearTimeout(closeTimer)
    cb(err)
  })

  client.once('server_info', function (packet) {
    const data = JSON.parse(packet.response)
    const start = Date.now()
    const maxTime = setTimeout(() => {
      clearTimeout(closeTimer)
      cb(null, data)
      client.end()
    }, options.noPongTimeout)
    client.once('ping', function (packet) {
      data.latency = Date.now() - start
      clearTimeout(maxTime)
      clearTimeout(closeTimer)
      cb(null, data)
      client.end()
    })
    client.write('ping', { time: [0, 0] })
  })

  client.on('state', function (newState) {
    if (newState === states.STATUS) { client.write('ping_start', {}) }
  })

  // TODO: refactor with src/client/setProtocol.js
  client.on('connect', function () {
    client.write('set_protocol', {
      protocolVersion: options.protocolVersion,
      serverHost: options.host,
      serverPort: options.port,
      nextState: 1
    })
    client.state = states.STATUS
  })

  // timeout against servers that never reply while keeping
  // the connection open and alive.
  closeTimer = setTimeout(function () {
    client.end()
    cb(new Error('ETIMEDOUT'))
  }, options.closeTimeout)

  tcpDns(client, options)
  options.connect(client)
}
