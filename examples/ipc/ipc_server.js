/** IPC Connection example
 *
 * This example shows how to use a IPC connection to communicate with a server or client.
 *
 * See the node.js documentation about IPC connections here: https://nodejs.org/api/net.html#identifying-paths-for-ipc-connections
 */

const nmp = require('minecraft-protocol')
const net = require('net')

const ipcName = 'minecraft-ipc'

// IPC with node.js works differently on windows and unix systems
let ipcPath
if (process.platform === 'win32') {
  ipcPath = `\\\\.\\pipe\\${ipcName}`
} else {
  ipcPath = `/tmp/${ipcName}.sock`
}

const server = nmp.createServer({
  version: '1.18.2',
  socketType: 'ipc',
  host: ipcPath, // When the optional option socketType is 'ipc' the host becomes the socket path
  'online-mode': false
})

server.on('listening', () => {
  console.info('Server listening on', server.socketServer.address())
  connectAClient()
})

server.on('login', (client) => {
  console.info(`New user '${client.username}' logged into the server`)
})

function connectAClient () {
  const client = nmp.createClient({
    version: '1.18.2',
    username: 'ipc_client',
    connect: (client) => {
      const socket = net.connect(ipcPath, () => {
        client.setSocket(socket)
        client.emit('connect')
      })
    },
    auth: 'offline'
  })
  client.on('connect', () => console.info('Client connected to server'))
  client.on('end', () => console.info('Client disconnected from server'))
}
