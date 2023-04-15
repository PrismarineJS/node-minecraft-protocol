'use strict'

const mc = require('minecraft-protocol')

const [,, username, realmName] = process.argv
if (!realmName) {
  console.log('Usage : node client_realms.js <username/email> <realm_name>')
  process.exit(1)
}

const client = mc.createClient({
  realms: {
    // realmId: '1234567', // Connect the client to a Realm using the Realms ID
    pickRealm: (realms) => realms.find(e => e.name === realmName) // Connect the client to a Realm using a function that returns a Realm
  },
  username,
  auth: 'microsoft' // This option must be present and set to 'microsoft' to  join a Realm.
})

client.on('connect', function () {
  console.info('connected')
})
client.on('disconnect', function (packet) {
  console.log('disconnected: ' + packet.reason)
})
