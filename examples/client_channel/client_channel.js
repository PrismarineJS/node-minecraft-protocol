const mc = require('minecraft-protocol')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node client_channel.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

function getBrandChannelName () {
  const mcData = require('minecraft-data')(client.version)
  if (mcData.supportFeature('customChannelIdentifier')) {
    return 'minecraft:brand' // 1.13+
  }
  return 'MC|Brand'
}

const client = mc.createClient({
  version: false,
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'test',
  password: process.argv[5]
})

client.on('error', console.log)

client.on('login', function () {
  const brandChannel = getBrandChannelName()
  client.registerChannel(brandChannel, ['string', []])
  client.on(brandChannel, console.log)
  client.writeChannel(brandChannel, 'vanilla')
})
