'use strict'

const net = require('net')
const http = require('http')
const https = require('https')

/**
 * Creates a proxy connection handler for the given proxy configuration
 * @param {Object} proxyConfig - Proxy configuration
 * @param {string} proxyConfig.type - Proxy type ('socks4', 'socks5', 'http', 'https')
 * @param {string} proxyConfig.host - Proxy host
 * @param {number} proxyConfig.port - Proxy port
 * @param {Object} [proxyConfig.auth] - Authentication credentials
 * @param {string} [proxyConfig.auth.username] - Username
 * @param {string} [proxyConfig.auth.password] - Password
 * @returns {Function} Connection handler function
 */
function createProxyConnector (proxyConfig) {
  switch (proxyConfig.type.toLowerCase()) {
    case 'socks4':
      return createSocks4Connector(proxyConfig)
    case 'socks5':
      return createSocks5Connector(proxyConfig)
    case 'http':
    case 'https':
      return createHttpConnector(proxyConfig)
    default:
      throw new Error(`Unsupported proxy type: ${proxyConfig.type}`)
  }
}

/**
 * Creates a SOCKS4 connection handler
 */
function createSocks4Connector (proxyConfig) {
  return function (client, targetHost, targetPort) {
    const socket = net.createConnection(proxyConfig.port, proxyConfig.host)

    socket.on('connect', () => {
      // SOCKS4 connect request
      const userId = proxyConfig.auth?.username || ''
      const request = Buffer.alloc(9 + userId.length)

      request[0] = 0x04 // SOCKS version
      request[1] = 0x01 // Connect command
      request.writeUInt16BE(targetPort, 2) // Port

      // Convert hostname to IP if needed
      const targetIP = net.isIP(targetHost) ? targetHost : '0.0.0.1' // Use 0.0.0.1 for hostname
      const ipParts = targetIP.split('.')
      request[4] = parseInt(ipParts[0])
      request[5] = parseInt(ipParts[1])
      request[6] = parseInt(ipParts[2])
      request[7] = parseInt(ipParts[3])

      request.write(userId, 8) // User ID
      request[8 + userId.length] = 0x00 // Null terminator

      // Add hostname if using SOCKS4A (when IP is 0.0.0.x)
      if (!net.isIP(targetHost)) {
        const hostnameBuffer = Buffer.from(targetHost + '\0')
        const fullRequest = Buffer.concat([request, hostnameBuffer])
        socket.write(fullRequest)
      } else {
        socket.write(request)
      }
    })

    socket.once('data', (data) => {
      if (data.length < 8) {
        socket.destroy()
        client.emit('error', new Error('Invalid SOCKS4 response'))
        return
      }

      if (data[1] === 0x5A) { // Request granted
        client.setSocket(socket)
        client.emit('connect')
      } else {
        socket.destroy()
        client.emit('error', new Error(`SOCKS4 connection failed: ${data[1]}`))
      }
    })

    socket.on('error', (err) => {
      client.emit('error', new Error(`SOCKS4 proxy error: ${err.message}`))
    })
  }
}

/**
 * Creates a SOCKS5 connection handler
 */
function createSocks5Connector (proxyConfig) {
  return function (client, targetHost, targetPort) {
    const socket = net.createConnection(proxyConfig.port, proxyConfig.host)
    let stage = 'auth'

    socket.on('connect', () => {
      // Authentication negotiation
      const authMethods = proxyConfig.auth ? [0x00, 0x02] : [0x00] // No auth + Username/Password
      const authRequest = Buffer.from([0x05, authMethods.length, ...authMethods])
      socket.write(authRequest)
    })

    socket.on('data', (data) => {
      if (stage === 'auth') {
        if (data.length < 2 || data[0] !== 0x05) {
          socket.destroy()
          client.emit('error', new Error('Invalid SOCKS5 auth response'))
          return
        }

        if (data[1] === 0xFF) {
          socket.destroy()
          client.emit('error', new Error('SOCKS5 authentication failed'))
          return
        }

        if (data[1] === 0x02 && proxyConfig.auth) {
          // Username/password authentication
          const username = proxyConfig.auth.username || ''
          const password = proxyConfig.auth.password || ''
          const authData = Buffer.alloc(3 + username.length + password.length)

          authData[0] = 0x01 // Auth version
          authData[1] = username.length
          authData.write(username, 2)
          authData[2 + username.length] = password.length
          authData.write(password, 3 + username.length)

          socket.write(authData)
          stage = 'userpass'
        } else {
          // No authentication required
          sendConnectRequest()
        }
      } else if (stage === 'userpass') {
        if (data.length < 2 || data[0] !== 0x01) {
          socket.destroy()
          client.emit('error', new Error('Invalid SOCKS5 userpass response'))
          return
        }

        if (data[1] !== 0x00) {
          socket.destroy()
          client.emit('error', new Error('SOCKS5 username/password authentication failed'))
          return
        }

        sendConnectRequest()
      } else if (stage === 'connect') {
        if (data.length < 10 || data[0] !== 0x05) {
          socket.destroy()
          client.emit('error', new Error('Invalid SOCKS5 connect response'))
          return
        }

        if (data[1] === 0x00) { // Success
          client.setSocket(socket)
          client.emit('connect')
        } else {
          socket.destroy()
          client.emit('error', new Error(`SOCKS5 connection failed: ${data[1]}`))
        }
      }
    })

    function sendConnectRequest () {
      stage = 'connect'
      const isIP = net.isIP(targetHost)
      const hostBuffer = isIP
        ? Buffer.from(targetHost.split('.').map(x => parseInt(x)))
        : Buffer.concat([Buffer.from([targetHost.length]), Buffer.from(targetHost)])

      const request = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00]), // Version, Connect, Reserved
        Buffer.from([isIP ? 0x01 : 0x03]), // Address type (IPv4 or Domain)
        hostBuffer,
        Buffer.allocUnsafe(2)
      ])

      request.writeUInt16BE(targetPort, request.length - 2)
      socket.write(request)
    }

    socket.on('error', (err) => {
      client.emit('error', new Error(`SOCKS5 proxy error: ${err.message}`))
    })
  }
}

/**
 * Creates an HTTP CONNECT proxy handler
 */
function createHttpConnector (proxyConfig) {
  return function (client, targetHost, targetPort) {
    const isHttps = proxyConfig.type.toLowerCase() === 'https'
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

    const httpModule = isHttps ? https : http
    const req = httpModule.request(connectOptions)

    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) {
        client.setSocket(socket)
        client.emit('connect')
      } else {
        socket.destroy()
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
 * Creates a proxy-aware agent for HTTP requests (used for authentication)
 */
function createProxyAgent (proxyConfig) {
  const agentOptions = {
    host: proxyConfig.host,
    port: proxyConfig.port
  }

  if (proxyConfig.auth) {
    agentOptions.auth = `${proxyConfig.auth.username}:${proxyConfig.auth.password}`
  }

  switch (proxyConfig.type.toLowerCase()) {
    case 'http':
      return new http.Agent(agentOptions)
    case 'https':
      return new https.Agent(agentOptions)
    case 'socks4':
    case 'socks5':
      // For SOCKS proxies, we'll use a simple HTTP agent for now
      // In production, you might want to use a proper SOCKS agent
      return new http.Agent()
    default:
      return undefined
  }
}

module.exports = {
  createProxyConnector,
  createProxyAgent
}
