const mc = require('minecraft-protocol')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node client_channel.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

const client = mc.createClient({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'test',
  password: process.argv[5],
  version: false
})

client.on('login', onlogin)
client.on('error', console.log)

function onlogin () {
  client.registerChannel('node-minecraft-protocol:custom_channel_one', ['string', []], true)
  client.registerChannel('node-minecraft-protocol:custom_channel_two', ['string', []], true)
  client.writeChannel('node-minecraft-protocol:custom_channel_one', 'hello from the client')
  client.on('node-minecraft-protocol:custom_channel_two', console.log)
}
