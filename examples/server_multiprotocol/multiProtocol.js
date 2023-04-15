// made for 1.19 - 1.19.3

const server = require('minecraft-protocol').createServer({
  encryption: false,
  version: false,
  motd: 'Multiprotocol example',
  'online-mode': false
})

server.on('login', function (client) {
  console.info(client.username + ' joined!')

  const mcData = require('minecraft-data')(server.version)

  client.write('login', mcData.loginPacket)
})
