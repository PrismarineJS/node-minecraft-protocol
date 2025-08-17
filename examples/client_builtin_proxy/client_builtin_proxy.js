const mc = require('minecraft-protocol')

const client = mc.createClient({
  host: 'localhost',
  port: 25565,
  username: 'testuser',
  proxy: {
    type: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    auth: { username: 'proxyuser', password: 'proxypass' } // optional
  }
})

client.on('connect', () => console.log('Connected via proxy!'))
client.on('error', (err) => console.error('Error:', err.message))
