'use strict'

const mc = require('minecraft-protocol')

const [,, username] = process.argv
if (!username) {
  console.log('Usage : node client_realms.js <username/email>')
  process.exit(1)
}

const client = mc.createClient({
  realms: {
    // realmId: '1234567', // Connect the client to a Realm using the Realms ID
    pickRealm: (realms) => realms.find(e => e.name === 'Realm Name') // Connect the client to a Realm using a function that returns a Realm
  },
  username: username,
  auth: 'microsoft' // This option must be present and set to 'microsoft' to  join a Realm.
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
