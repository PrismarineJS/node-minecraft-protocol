'use strict'

const Client = require('./client')
const states = require('./states')
const tcpDns = require('./client/tcp_dns')

module.exports = cbPing

function cbPing (options, cb) {
  const pingPromise = ping(options)
  if (cb) {
    pingPromise.then((d) => {
      cb(null, d)
    }).catch((err) => {
      cb(err, null)
    })
  }
  return pingPromise
};

function ping (options) {
  options.host = options.host || 'localhost'
  options.port = options.port || 25565
  const optVersion = options.version || require('./version').defaultVersion
  const mcData = require('minecraft-data')(optVersion)
  const version = mcData.version
  options.majorVersion = version.majorVersion
  options.protocolVersion = version.version
  let closeTimer = null
  options.closeTimeout = options.closeTimeout || 120 * 1000
  options.noPongTimeout = options.noPongTimeout || 5 * 1000

  const client = new Client(false, version.minecraftVersion)
  return new Promise((resolve, reject) => {
    client.on('error', function (err) {
      clearTimeout(closeTimer)
      client.end()
      reject(err)
    })
    client.once('server_info', function (packet) {
      const data = JSON.parse(packet.response)
      const start = Date.now()
      const maxTimer = setTimeout(() => {
        clearTimeout(closeTimer)
        client.end()
        resolve(data)
      }, options.noPongTimeout)
      const time = BigInt(Date.now())
      client.once('ping', function (packet) {
        data.latency = Date.now() - start
        if (BigInt(packet.time) === time) {
          // pong payload should be the same as ping payload
          clearTimeout(maxTimer)
          clearTimeout(closeTimer)
          client.end()
          resolve(data)
        }
      })
      client.write('ping', { time })
    })
    client.on('state', function (newState) {
      if (newState === states.STATUS) {
        client.write('ping_start', {})
      }
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
      reject(new Error('ETIMEDOUT'))
    }, options.closeTimeout)
    tcpDns(client, options)
    options.connect(client)
  })
};
