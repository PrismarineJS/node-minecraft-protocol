'use strict'

const mc = require('minecraft-protocol')

const [, , host, port, username, password] = process.argv
if (!username || !password) {
  console.log('Usage : node client_custom_auth.js <host> <port> <username/email> [<password>]')
  process.exit(1)
}

const client = mc.createClient({
  host,
  port: parseInt(port),
  username,
  password,
  sessionServer: '', // URL to your session server proxy that changes the expected result of mojang's seession server to mcleaks expected.
  // For more information: https://github.com/PrismarineJS/node-yggdrasil/blob/master/src/Server.js#L19
  auth: async (client, options) => {
    // handle custom authentication your way.

    // client.username = options.username
    // options.accessToken =
    return options.connect(client)
  }
})

client.on('connect', function () {
  console.info('connected')
})
client.on('disconnect', function (packet) {
  console.log('disconnected: ' + packet.reason)
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
