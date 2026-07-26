// Demonstrates following a server-initiated Transfer packet (added in 1.20.5, used by
// the vanilla /transfer command and by proxies/plugins that hand a player off to a
// different server, e.g. for load balancing or a low-latency regional server).
//
// The important part is the reconnect: end() the current connection and wait for it to
// fully close, then wait a short beat, before connecting to the new host:port with the
// same username. Reconnecting immediately can race the server's own cleanup of the old
// session and get rejected with "already playing on the server" (Bukkit/Paper's
// duplicate-login check), since the server hasn't necessarily finished processing the
// old connection's teardown yet.
const mc = require('minecraft-protocol')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node client_transfer.js <host> <port> [<name>]')
  process.exit(1)
}

const host = process.argv[2]
const port = parseInt(process.argv[3])
const username = process.argv[4] || 'transfer_bot'

function connect (host, port) {
  const client = mc.createClient({ host, port, username })

  client.on('connect', () => console.log(`connecting to ${host}:${port}`))
  client.on('login', () => console.log(`logged in to ${host}:${port}`))
  client.on('error', (err) => console.error('error:', err))
  client.on('disconnect', (packet) => console.log('disconnected:', packet.reason))
  client.on('kick_disconnect', (packet) => console.log('kicked:', packet.reason))

  client.on('transfer', async (packet) => {
    console.log(`received transfer packet -> ${packet.host}:${packet.port}, reconnecting`)
    await new Promise((resolve) => {
      client.once('end', resolve)
      client.end()
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    connect(packet.host, packet.port)
  })

  return client
}

connect(host, port)
