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
  version: '1.10'
})

client.on('login', onlogin)
client.on('error', console.log)

function onlogin () {
  client.registerChannel('CUSTOM|ChannelOne', ['i32', []], true)
  client.registerChannel('CUSTOM|ChannelTwo', ['i32', []], true)
  client.writeChannel('CUSTOM|ChannelOne', 4)
  client.on('CUSTOM|ChannelTwo', console.log)
}
