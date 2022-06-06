const nmp = require('minecraft-protocol')
const net = require('net')

let ipcPath
if (process.platform === 'win32') {
  ipcPath = '\\\\.\\pipe\\minecraft-ipc'
} else {
  ipcPath = '/tmp/minecraft-ipc.sock'
}

const server = nmp.createServer({
  version: '1.12.2',
  socketType: 'ipc',
  socketPath: ipcPath,
  'online-mode': false
})

server.on('listening', () => {
  console.info('Server listening on', server.socketServer.address())
  const client = nmp.createClient({
    version: '1.12.2',
    username: 'ipcConnection',
    connect: (client) => {
      const socket = net.connect(ipcPath, () => {
        client.setSocket(socket)
        client.emit('connect')
      })
    }
  })
  client.on('connect', () => {
    console.info('Client connected')
  })
  client.once('error', () => {
    server.close()
  })
  client.once('end', () => {
    server.close()
  })
})

server.on('connection', () => {
  console.info('New connection')
})
