'use strict'

const mc = require('minecraft-protocol')

const [,, host, port, username, proxyHost, proxyPort] = process.argv
if (!host || !port || !username || !proxyHost || !proxyPort) {
  console.log('Usage: node client_builtin_proxy.js <host> <port> <username> <proxy_host> <proxy_port>')
  console.log('Example: node client_builtin_proxy.js localhost 25565 testuser 127.0.0.1 1080')
  process.exit(1)
}

const client = mc.createClient({
  host,
  port: parseInt(port),
  username,
  auth: 'offline',
  proxy: {
    type: 'socks5',
    host: proxyHost,
    port: parseInt(proxyPort)
    // auth: { username: 'proxyuser', password: 'proxypass' } // optional
  }
})

client.on('connect', function () {
  console.log('Connected to server via SOCKS5 proxy!')
})

client.on('disconnect', function (packet) {
  console.log('Disconnected from server: ' + packet.reason)
})

client.on('end', function () {
  console.log('Connection ended')
  process.exit()
})

client.on('error', function (err) {
  console.log('Connection error:', err.message)
  process.exit(1)
})
