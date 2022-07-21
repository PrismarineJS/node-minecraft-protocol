const net = require('net')

const getPort = () => new Promise(resolve => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  server.on('listening', () => {
    const { port } = server.address()
    server.close(() => resolve(port))
  })
})

function serverchat (client, message) {
  const [event, data] = makeBroadcast(client.version, message)
  client.write(event, data)
}

function makeBroadcast (version, message) {
  const mcData = require('minecraft-data')(version)
  if (mcData.supportFeature('signedChat')) {
    // 1.19+
    return ['player_chat', {
      signedChatContent: JSON.stringify({ text: message }),
      unsignedChatContent: undefined,
      type: 0,
      senderUuid: '0',
      senderName: 'Server',
      timestamp: Date.now() * 1000,
      salt: 0,
      signature: []
    }]
  } else {
    // pre 1.19
    return ['chat', {
      message: JSON.stringify({ text: message }),
      position: 0,
      sender: '0'
    }]
  }
}

function chat (client, message) {
  const mcData = require('minecraft-data')(client.version)
  if (mcData.supportFeature('signedChat')) {
    // 1.19+

    client.write('chat_message', {
      message,
      timestamp: Date.now() * 1000,
      salt: 0,
      signature: [],
      signedPreview: true
    })
  } else {
    // pre 1.19

    client.write('chat', {
      message
    })
  }
}

function clientXChat (x, client, fn) {
  const mcData = require('minecraft-data')(client.version)
  if (mcData.supportFeature('signedChat')) {
    // 1.19+

    x.bind(client)('player_chat', (packet) => {
      const message = packet.unsignedChatContent || packet.signedChatContent
      fn(message)
    })
  } else {
    // pre 1.19

    x.bind(client)('chat', (packet) => {
      const message = packet.message
      fn(message)
    })
  }
}

function serverXChat (x, server, fn) {
  const mcData = require('minecraft-data')(server.version)
  if (mcData.supportFeature('signedChat')) {
    // 1.19+

    x.bind(server)('chat_message', (packet) => {
      const message = packet.message
      fn(message)
    })
  } else {
    // pre 1.19

    x.bind(server)('chat', (packet) => {
      const message = packet.message
      fn(message)
    })
  }
}

function OnceChat (client, fn) {
  clientXChat(client.once, client, fn)
}
function OnChat (client, fn) {
  clientXChat(client.on, client, fn)
}
async function OnceChatPromise (client) {
  const mcData = require('minecraft-data')(client.version)
  const { once } = require('events')
  if (mcData.supportFeature('signedChat')) {
    // 1.19+

    const [packet] = await once(client, 'player_chat')
    return packet.unsignedChatContent || packet.signedChatContent
  } else {
    // pre 1.19

    const [packet] = await once(client, 'chat')
    return packet.message
  }
}

module.exports = { getPort, serverchat, makeBroadcast, chat, OnceChat, OnceChatPromise, OnChat, clientXChat, serverXChat }
