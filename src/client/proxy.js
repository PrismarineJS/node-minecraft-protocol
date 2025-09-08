'use strict'

const http = require('http')
const https = require('https')

/**
 * Creates a proxy-aware connect function based on proxy configuration
 * @param {Object} proxyConfig - Proxy configuration
 * @param {string} proxyConfig.type - Proxy type ('socks4', 'socks5', 'http', 'https')
 * @param {string} proxyConfig.host - Proxy host
 * @param {number} proxyConfig.port - Proxy port
 * @param {Object} [proxyConfig.auth] - Authentication credentials
 * @param {string} [proxyConfig.auth.username] - Username
 * @param {string} [proxyConfig.auth.password] - Password
 * @param {string} targetHost - Target Minecraft server host
 * @param {number} targetPort - Target Minecraft server port
 * @returns {Function} Connection handler function
 */
function createProxyConnect (proxyConfig, targetHost, targetPort) {
  switch (proxyConfig.type.toLowerCase()) {
    case 'http':
    case 'https':
      return createHttpConnect(proxyConfig, targetHost, targetPort)
    case 'socks4':
    case 'socks5':
      return createSocksConnect(proxyConfig, targetHost, targetPort)
    default:
      throw new Error(`Unsupported proxy type: ${proxyConfig.type}`)
  }
}

/**
 * Creates HTTP CONNECT proxy function (based on existing client_http_proxy example)
 */
function createHttpConnect (proxyConfig, targetHost, targetPort) {
  return function (client) {
    const connectOptions = {
      host: proxyConfig.host,
      port: proxyConfig.port,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`
    }

    // Add authentication header if provided
    if (proxyConfig.auth) {
      const credentials = Buffer.from(`${proxyConfig.auth.username}:${proxyConfig.auth.password}`).toString('base64')
      connectOptions.headers = {
        'Proxy-Authorization': `Basic ${credentials}`
      }
    }

    const httpModule = proxyConfig.type.toLowerCase() === 'https' ? https : http
    const req = httpModule.request(connectOptions)

    req.on('connect', (res, stream) => {
      if (res.statusCode === 200) {
        client.setSocket(stream)
        client.emit('connect')
      } else {
        client.emit('error', new Error(`HTTP CONNECT failed: ${res.statusCode} ${res.statusMessage}`))
      }
    })

    req.on('error', (err) => {
      client.emit('error', new Error(`HTTP proxy error: ${err.message}`))
    })

    req.end()
  }
}

/**
 * Creates SOCKS proxy function (based on existing client_socks_proxy example)
 */
function createSocksConnect (proxyConfig, targetHost, targetPort) {
  return function (client) {
    let socks
    try {
      socks = require('socks').SocksClient
    } catch (err) {
      client.emit('error', new Error('SOCKS proxy requires "socks" package: npm install socks'))
      return
    }

    const socksOptions = {
      proxy: {
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: proxyConfig.type === 'socks4' ? 4 : 5
      },
      command: 'connect',
      destination: {
        host: targetHost,
        port: targetPort
      }
    }

    // Add authentication if provided (SOCKS5 only)
    if (proxyConfig.auth && proxyConfig.type === 'socks5') {
      socksOptions.proxy.userId = proxyConfig.auth.username
      socksOptions.proxy.password = proxyConfig.auth.password
    }

    socks.createConnection(socksOptions, (err, info) => {
      if (err) {
        client.emit('error', new Error(`SOCKS proxy error: ${err.message}`))
        return
      }
      client.setSocket(info.socket)
      client.emit('connect')
    })
  }
}

/**
 * Creates a proxy-aware agent for HTTP requests (used for authentication)
 */
function createProxyAgent (proxyConfig) {
  try {
    const ProxyAgent = require('proxy-agent')
    const protocol = proxyConfig.type.toLowerCase() === 'https'
      ? 'https:'
      : proxyConfig.type.toLowerCase() === 'http'
        ? 'http:'
        : proxyConfig.type.toLowerCase() === 'socks5'
          ? 'socks5:'
          : proxyConfig.type.toLowerCase() === 'socks4' ? 'socks4:' : 'http:'

    const agentOptions = {
      protocol,
      host: proxyConfig.host,
      port: proxyConfig.port
    }

    if (proxyConfig.auth) {
      agentOptions.auth = `${proxyConfig.auth.username}:${proxyConfig.auth.password}`
    }

    return new ProxyAgent(agentOptions)
  } catch (err) {
    // Fallback to basic agent if proxy-agent not available
    return new http.Agent()
  }
}

module.exports = {
  createProxyConnect,
  createProxyAgent
}
