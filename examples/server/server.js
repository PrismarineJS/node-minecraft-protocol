const mc = require('minecraft-protocol')
const nbt = require('prismarine-nbt')

const options = {
  motd: 'Vox Industries',
  'max-players': 127,
  port: 25565,
  'online-mode': false
}

const server = mc.createServer(options)
const mcData = require('minecraft-data')(server.version)
const loginPacket = mcData.loginPacket
function chatText (text) {
  return mcData.supportFeature('chatPacketsUseNbtComponents')
    ? nbt.comp({ text: nbt.string(text) })
    : JSON.stringify({ text })
}

server.on('playerJoin', function (client) {
  broadcast(client.username + ' joined the game.')
  const addr = client.socket.remoteAddress + ':' + client.socket.remotePort
  console.log(client.username + ' connected', '(' + addr + ')')

  client.on('end', function () {
    broadcast(client.username + ' left the game.', client)
    console.log(client.username + ' disconnected', '(' + addr + ')')
  })

  // send init data so client will start rendering world
  client.write('login', {
    ...loginPacket,
    enforceSecureChat: false,
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 1,
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  })
  client.write('position', {
    x: 0,
    y: 256,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })

  function handleChat (data) {
    const message = '<' + client.username + '>' + ' ' + data.message
    broadcast(message, null, client.username)
    console.log(message)
  }
  client.on('chat', handleChat) // pre-1.19
  client.on('chat_message', handleChat) // post 1.19
})

server.on('error', function (error) {
  console.log('Error:', error)
})

server.on('listening', function () {
  console.log('Server listening on port', server.socketServer.address().port)
})

function sendBroadcastMessage (server, clients, message, sender) {
  if (mcData.supportFeature('signedChat')) {
    server.writeToClients(clients, 'player_chat', {
      plainMessage: message,
      signedChatContent: '',
      unsignedChatContent: chatText(message),
      type: 0,
      senderUuid: 'd3527a0b-bc03-45d5-a878-2aafdd8c8a43', // random
      senderName: JSON.stringify({ text: sender }),
      senderTeam: undefined,
      timestamp: Date.now(),
      salt: 0n,
      signature: mcData.supportFeature('useChatSessions') ? undefined : Buffer.alloc(0),
      previousMessages: [],
      filterType: 0,
      networkName: JSON.stringify({ text: sender })
    })
  } else {
    server.writeToClients(clients, 'chat', { message: JSON.stringify({ text: message }), position: 0, sender: sender || '0' })
  }
}

function broadcast (message, exclude, username) {
  sendBroadcastMessage(server, Object.values(server.clients).filter(client => client !== exclude), message)
}
