'use strict'

const mc = require('minecraft-protocol')

const [,, host, port, userOrEmail, password] = process.argv
if (!userOrEmail) {
  console.log('Usage : node client_microsoft_auth.js <host> <port> <username/email> [<password>]')
  process.exit(1)
}

const client = mc.createClient({
  host,
  port: parseInt(port),
  username: userOrEmail, // your microsoft account email
  password: password, // your microsoft account password
  auth: 'microsoft' // This option must be present and set to 'microsoft' to use Microsoft Account Authentication. Failure to do so will result in yggdrasil throwing invalid account information.
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
