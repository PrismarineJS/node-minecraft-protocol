const mc = require('minecraft-protocol')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node client_channel.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

const client = mc.createClient({
  version: false,
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'test',
  password: process.argv[5]
})

client.registerChannel('MC|Brand', ['string', []])
client.on('MC|Brand', console.log)

client.on('login', function () {
  client.writeChannel('MC|Brand', 'vanilla')
})
client.on('error', console.log)
