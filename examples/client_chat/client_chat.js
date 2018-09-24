const readline = require('readline')
const color = require('ansi-color').set
const mc = require('minecraft-protocol')
const states = mc.states
const util = require('util')

const colors = {
  'black': 'black+white_bg',
  'dark_blue': 'blue',
  'dark_green': 'green',
  'dark_aqua': 'cyan',
  'dark_red': 'red',
  'dark_purple': 'magenta',
  'gold': 'yellow',
  'gray': 'black+white_bg',
  'dark_gray': 'black+white_bg',
  'blue': 'blue',
  'green': 'green',
  'aqua': 'cyan',
  'red': 'red',
  'light_purple': 'magenta',
  'yellow': 'yellow',
  'white': 'white',
  'obfuscated': 'blink',
  'bold': 'bold',
  'strikethrough': '',
  'underlined': 'underlined',
  'italic': '',
  'reset': 'white+black_bg'
}

const dictionary = {
  'chat.stream.emote': '(%s) * %s %s',
  'chat.stream.text': '(%s) <%s> %s',
  'chat.type.achievement': '%s has just earned the achievement %s',
  'chat.type.admin': '[%s: %s]',
  'chat.type.announcement': '[%s] %s',
  'chat.type.emote': '* %s %s',
  'chat.type.text': '<%s> %s'
}

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
  console.info(color('Kicked for ' + packet.reason, 'blink+red'))
  process.exit(1)
})

const chats = []

client.on('connect', function () {
  console.info(color('Successfully connected to ' + host + ':' + port, 'blink+green'))
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
  const j = JSON.parse(packet.message)
  const chat = parseChat(j, {})
  console.info(chat)
})

function parseChat (chatObj, parentState) {
  function getColorize (parentState) {
    let myColor = ''
    if ('color' in parentState) myColor += colors[parentState.color] + '+'
    if (parentState.bold) myColor += 'bold+'
    if (parentState.underlined) myColor += 'underline+'
    if (parentState.obfuscated) myColor += 'obfuscated+'
    if (myColor.length > 0) myColor = myColor.slice(0, -1)
    return myColor
  }

  if (typeof chatObj === 'string') {
    return color(chatObj, getColorize(parentState))
  } else {
    let chat = ''
    if ('color' in chatObj) parentState.color = chatObj['color']
    if ('bold' in chatObj) parentState.bold = chatObj['bold']
    if ('italic' in chatObj) parentState.italic = chatObj['italic']
    if ('underlined' in chatObj) parentState.underlined = chatObj['underlined']
    if ('strikethrough' in chatObj) parentState.strikethrough = chatObj['strikethrough']
    if ('obfuscated' in chatObj) parentState.obfuscated = chatObj['obfuscated']

    if ('text' in chatObj) {
      chat += color(chatObj.text, getColorize(parentState))
    } else if ('translate' in chatObj && dictionary.hasOwnProperty(chatObj.translate)) {
      const args = [dictionary[chatObj.translate]]
      chatObj['with'].forEach(function (s) {
        args.push(parseChat(s, parentState))
      })

      chat += color(util.format.apply(this, args), getColorize(parentState))
    }
    if (chatObj.extra) {
      chatObj.extra.forEach(function (item) {
        chat += parseChat(item, parentState)
      })
    }
    return chat
  }
}
