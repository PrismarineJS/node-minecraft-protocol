/** IPC Connection example
 *
 * This example shows how to use a IPC connection to communicate with a server or client.
 *
 * See the node.js documentation about IPC connections here: https://nodejs.org/api/net.html#identifying-paths-for-ipc-connections
 */

const nmp = require('minecraft-protocol')
const net = require('net')

let ipcPath
if (process.platform === 'win32') {
  ipcPath = '\\\\.\\pipe\\minecraft-ipc'
} else {
  ipcPath = '/tmp/minecraft-ipc.sock'
}

const server = nmp.createServer({
  version: '1.18.2',
  socketType: 'ipc',
  host: ipcPath, // When socketType is 'ipc' the host becomes the socket path
  'online-mode': false
})

server.on('listening', () => {
  console.info('Server listening on', server.socketServer.address())
  const client = nmp.createClient({
    version: '1.18.2',
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
