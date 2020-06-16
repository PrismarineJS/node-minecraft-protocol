const mc = require('minecraft-protocol')
const socks = require('socks').SocksClient
const ProxyAgent = require('proxy-agent')

if (process.argv.length < 6 || process.argv.length > 8) {
  console.log('Usage : node client_socks_proxy.js <host> <port> <proxyHost> <proxyPort> [<name>] [<password>]')
  process.exit(1)
}

const proxyHost = process.argv[4]
const proxyPort = process.argv[5]

const client = mc.createClient({
  connect: client => {
    socks.createConnection({
      proxy: {
        host: proxyHost,
        port: parseInt(proxyPort),
        type: 5
      },
      command: 'connect',
      destination: {
        host: process.argv[2],
        port: parseInt(process.argv[3])
      }
    }, (err, info) => {
      if (err) {
        console.log(err)
        return
      }

      client.setSocket(info.socket)
      client.emit('connect')
    })
  },
  agent: new ProxyAgent({ protocol: 'socks5:', host: proxyHost, port: proxyPort }),
  username: process.argv[6] ? process.argv[6] : 'echo',
  password: process.argv[7]
})

client.on('connect', function () {
  console.info('connected')
})
client.on('disconnect', function (packet) {
  console.log('disconnected: ' + packet.reason)
})
client.on('end', function () {
  console.log('Connection lost')
})
client.on('chat', function (packet) {
  const jsonMsg = JSON.parse(packet.message)
  if (jsonMsg.translate === 'chat.type.announcement' || jsonMsg.translate === 'chat.type.text') {
    const username = jsonMsg.with[0].text
    const msg = jsonMsg.with[1]
    if (username === client.username) return
    client.write('chat', { message: msg })
  }
})
