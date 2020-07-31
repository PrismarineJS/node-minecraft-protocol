const readline = require('readline')
const mc = require('minecraft-protocol')
const states = mc.states

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

function printHelp () {
  console.log('usage: node client_chat.js <hostname> <port> <user> [<password>]')
}

if (process.argv.length < 5) {
  console.log('Too few arguments!')
  printHelp()
  process.exit(1)
}

process.argv.forEach(function (val) {
  if (val === '-h') {
    printHelp()
    process.exit(0)
  }
})

let host = process.argv[2]
let port = parseInt(process.argv[3])
const user = process.argv[4]
const passwd = process.argv[5]

let ChatMessage

if (host.indexOf(':') !== -1) {
  port = host.substring(host.indexOf(':') + 1)
  host = host.substring(0, host.indexOf(':'))
}

console.log('connecting to ' + host + ':' + port)
console.log('user: ' + user)

const client = mc.createClient({
  host: host,
  port: port,
  username: user,
  password: passwd
})

client.on('kick_disconnect', function (packet) {
  console.info('Kicked for ' + packet.reason)
  process.exit(1)
})

const chats = []

client.on('connect', function () {
  ChatMessage = require('prismarine-chat')(client.version)
  console.info('Successfully connected to ' + host + ':' + port)
})

client.on('disconnect', function (packet) {
  console.log('disconnected: ' + packet.reason)
})

client.on('end', function () {
  console.log('Connection lost')
  process.exit()
})

client.on('error', function (err) {
  console.log('Error occured')
  console.log(err)
  process.exit(1)
})

client.on('state', function (newState) {
  if (newState === states.PLAY) {
    chats.forEach(function (chat) {
      client.write('chat', { message: chat })
    })
  }
})

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
  if (!client.write('chat', { message: line })) {
    chats.push(line)
  }
})

client.on('chat', function (packet) {
  if (!ChatMessage) return // Return if ChatMessage is not loaded yet.
  const j = JSON.parse(packet.message)
  const chat = new ChatMessage(j)
  console.info(chat.toAnsi())
})
