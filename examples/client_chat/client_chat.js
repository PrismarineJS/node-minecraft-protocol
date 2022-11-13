const mc = require('minecraft-protocol')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

const [,, host, port, username] = process.argv
if (!host || !port) {
  console.error('Usage: node client_chat.js <host> <port> <username>')
  console.error('Usage (offline mode): node client_chat.js <host> <port> offline')
  process.exit(1)
}

const client = mc.createClient({
  host,
  port,
  username,
  auth: username === 'offline' ? 'offline' : 'microsoft'
})

// Boilerplate
client.on('disconnect', function (packet) {
  console.log('Disconnected from server : ' + packet.reason)
})

client.on('end', function () {
  console.log('Connection lost')
  process.exit()
})

client.on('error', function (err) {
  console.log('Error occurred')
  console.log(err)
  process.exit(1)
})

client.on('connect', () => {
  const mcData = require('minecraft-data')(client.version)
  const ChatMessage = require('prismarine-chat')(client.version)
  const players = {} // 1.19+

  console.log('Connected to server')

  client.chat = (message) => {
    if (mcData.supportFeature('signedChat')) {
      const timestamp = BigInt(Date.now())
      client.write('chat_message', {
        message,
        timestamp,
        salt: 0,
        signature: client.signMessage(message, timestamp)
      })
    } else {
      client.write('chat', { message })
    }
  }

  function onChat (packet) {
    const message = packet.message || packet.unsignedChatContent || packet.signedChatContent
    const j = JSON.parse(message)
    const chat = new ChatMessage(j)

    if (packet.signature) {
      const verified = client.verifyMessage(players[packet.senderUuid].publicKey, packet)
      console.info(verified ? 'Verified: ' : 'UNVERIFIED: ', chat.toAnsi())
    } else {
      console.info(chat.toAnsi())
    }
  }

  client.on('chat', onChat)
  client.on('player_chat', onChat)
  client.on('player_info', (packet) => {
    if (packet.action === 0) { // add player
      for (const player of packet.data) {
        players[player.UUID] = player.crypto
      }
    }
  })
})

// Send the queued messages
const queuedChatMessages = []
client.on('state', function (newState) {
  if (newState === mc.states.PLAY) {
    queuedChatMessages.forEach(message => client.chat(message))
    queuedChatMessages.length = 0
  }
})

// Listen for messages written to the console, send them to game chat
rl.on('line', function (line) {
  if (line === '') {
    return
  } else if (line === '/quit') {
    console.info('Disconnected from ' + host + ':' + port)
    client.end()
    return
  } else if (line === '/end') {
    console.info('Forcibly ended client')
    process.exit(0)
  }
  if (!client.chat) {
    queuedChatMessages.push(line)
  } else {
    client.chat(line)
  }
})
