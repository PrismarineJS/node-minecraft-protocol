const protocol = require('minecraft-protocol') // Lets define protocol

if (process.argv.length < 3 || process.argv.length > 3) { // Check for args for prevent crashing etc.
  console.log('Usage : node ping.js <host>:[<port>]')
  process.exit(1)
}

function removeColorsFromString (text) { // Removing minecraft colors from strings, because console can`t read it and it will look crazy.
  return text.replace(/§./g, '')
}

let host
let port

if (!process.argv[2].includes(':')) { // Spliting ip and port if available.
  host = process.argv[2]
  port = 25565
} else {
  [host, port] = process.argv[2].split(':')
  port = parseInt(port)
}

protocol.ping({ host, port }, (err, pingResults) => { // Pinging server and getting result
  if (err) throw err
  console.log(`${removeColorsFromString(JSON.stringify(pingResults.description.text))}`) // Printing motd to console
  // Printing some infos to console
  console.log(`${JSON.stringify(pingResults.latency)} ms | ${JSON.stringify(pingResults.players.online)}/${JSON.stringify(pingResults.players.max)} | ${JSON.stringify(removeColorsFromString(pingResults.version.name))}.${JSON.stringify(pingResults.version.protocol)}`)
})
