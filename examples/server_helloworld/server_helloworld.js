const mc = require('minecraft-protocol')

const options = {
  'online-mode': true,
  version: '1.16'
}

const server = mc.createServer(options)
const mcData = require('minecraft-data')(server.version)
const loginPacket = mcData.loginPacket
const nbt = require('prismarine-nbt')

function chatText (text) {
  return mcData.supportFeature('chatPacketsUseNbtComponents')
    ? nbt.comp({ text: nbt.string(text) })
    : JSON.stringify({ text })
}

server.on('playerJoin', function (client) {
  const addr = client.socket.remoteAddress
  console.log('Incoming connection', '(' + addr + ')')

  client.on('end', function () {
    console.log('Connection closed', '(' + addr + ')')
  })

  client.on('error', function (error) {
    console.log('Error:', error)
  })

  // send init data so client will start rendering world
  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 1,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
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
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })

  const message = {
    translate: 'chat.type.announcement',
    with: [
      'Server',
      'Hello, world!'
    ]
  }
  if (mcData.supportFeature('signedChat')) {
    client.write('player_chat', {
      plainMessage: message,
      signedChatContent: '',
      unsignedChatContent: chatText(message),
      type: 0,
      senderUuid: 'd3527a0b-bc03-45d5-a878-2aafdd8c8a43', // random
      senderName: JSON.stringify({ text: 'me' }),
      senderTeam: undefined,
      timestamp: Date.now(),
      salt: 0n,
      signature: mcData.supportFeature('useChatSessions') ? undefined : Buffer.alloc(0),
      previousMessages: [],
      filterType: 0,
      networkName: JSON.stringify({ text: 'me' })
    })
  } else {
    client.write('chat', { message: JSON.stringify({ text: message }), position: 0, sender: 'me' })
  }
})

server.on('error', function (error) {
  console.log('Error:', error)
})

server.on('listening', function () {
  console.log('Server listening on port', server.socketServer.address().port)
})
