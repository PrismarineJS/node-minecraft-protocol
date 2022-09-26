const mc = require('minecraft-protocol')

const states = mc.states
function printHelpAndExit (exitCode) {
  console.log('usage: node proxy.js [<options>...] <target_srv> <version>')
  console.log('options:')
  console.log('  --dump name')
  console.log('    print to stdout messages with the specified name.')
  console.log('  --dump-all')
  console.log('    print to stdout all messages, except those specified with -x.')
  console.log('  -x name')
  console.log('    do not print messages with this name.')
  console.log('  name')
  console.log('    a packet name as defined in protocol.json')
  console.log('examples:')
  console.log('  node proxy.js --dump-all -x keep_alive -x update_time -x entity_velocity -x rel_entity_move -x entity_look -x entity_move_look -x entity_teleport -x entity_head_rotation -x position localhost 1.8')
  console.log('    print all messages except for some of the most prolific.')
  console.log('  node examples/proxy.js --dump open_window --dump close_window --dump set_slot --dump window_items --dump craft_progress_bar --dump transaction --dump close_window --dump window_click --dump set_creative_slot --dump enchant_item localhost 1.8')
  console.log('    print messages relating to inventory management.')

  process.exit(exitCode)
}

if (process.argv.length < 4) {
  console.log('Too few arguments!')
  printHelpAndExit(1)
}

process.argv.forEach(function (val) {
  if (val === '-h') {
    printHelpAndExit(0)
  }
})

const args = process.argv.slice(2)
let host
let port = 25565
let version

let printAllNames = false
const printNameWhitelist = {}
const printNameBlacklist = {};
(function () {
  let i = 0
  for (i = 0; i < args.length; i++) {
    const option = args[i]
    if (!/^-/.test(option)) break
    if (option === '--dump-all') {
      printAllNames = true
      continue
    }
    i++
    const name = args[i]
    if (option === '--dump') {
      printNameWhitelist[name] = 'io'
    } else if (option === '-x') {
      printNameBlacklist[name] = 'io'
    } else {
      printHelpAndExit(1)
    }
  }
  if (!(i + 2 <= args.length && args.length <= i + 4)) printHelpAndExit(1)
  host = args[i++]
  version = args[i++]
})()

if (host.indexOf(':') !== -1) {
  port = host.substring(host.indexOf(':') + 1)
  host = host.substring(0, host.indexOf(':'))
}

const srv = mc.createServer({
  'online-mode': false,
  port: 25566,
  keepAlive: false,
  version
})
srv.on('login', function (client) {
  const addr = client.socket.remoteAddress
  console.log('Incoming connection', '(' + addr + ')')
  let endedClient = false
  let endedTargetClient = false
  client.on('end', function () {
    endedClient = true
    console.log('Connection closed by client', '(' + addr + ')')
    if (!endedTargetClient) { targetClient.end('End') }
  })
  client.on('error', function (err) {
    endedClient = true
    console.log('Connection error by client', '(' + addr + ')')
    console.log(err.stack)
    if (!endedTargetClient) { targetClient.end('Error') }
  })
  const targetClient = mc.createClient({
    host,
    port,
    username: client.username,
    keepAlive: false,
    version
  })
  client.on('packet', function (data, meta) {
    if (targetClient.state === states.PLAY && meta.state === states.PLAY) {
      if (shouldDump(meta.name, 'o')) {
        console.log('client->server:',
          client.state + ' ' + meta.name + ' :',
          JSON.stringify(data))
      }
      if (!endedTargetClient) { targetClient.write(meta.name, data) }
    }
  })
  targetClient.on('packet', function (data, meta) {
    if (meta.state === states.PLAY && client.state === states.PLAY) {
      if (shouldDump(meta.name, 'i')) {
        console.log('client<-server:',
          targetClient.state + '.' + meta.name + ' :' +
          JSON.stringify(data))
      }
      if (!endedClient) {
        client.write(meta.name, data)
        if (meta.name === 'set_compression') {
          client.compressionThreshold = data.threshold
        } // Set compression
      }
    }
  })
  const bufferEqual = require('buffer-equal')
  targetClient.on('raw', function (buffer, meta) {
    if (client.state !== states.PLAY || meta.state !== states.PLAY) { return }
    const packetData = targetClient.deserializer.parsePacketBuffer(buffer).data.params
    const packetBuff = client.serializer.createPacketBuffer({ name: meta.name, params: packetData })
    if (!bufferEqual(buffer, packetBuff)) {
      console.log('client<-server: Error in packet ' + meta.state + '.' + meta.name)
      console.log('received buffer', buffer.toString('hex'))
      console.log('produced buffer', packetBuff.toString('hex'))
      console.log('received length', buffer.length)
      console.log('produced length', packetBuff.length)
    }
    /* if (client.state === states.PLAY && brokenPackets.indexOf(packetId.value) !=== -1)
     {
     console.log(`client<-server: raw packet);
     console.log(packetData);
     if (!endedClient)
     client.writeRaw(buffer);
     } */
  })
  client.on('raw', function (buffer, meta) {
    if (meta.state !== states.PLAY || targetClient.state !== states.PLAY) { return }
    const packetData = client.deserializer.parsePacketBuffer(buffer).data.params
    const packetBuff = targetClient.serializer.createPacketBuffer({ name: meta.name, params: packetData })
    if (!bufferEqual(buffer, packetBuff)) {
      console.log('client->server: Error in packet ' + meta.state + '.' + meta.name)
      console.log('received buffer', buffer.toString('hex'))
      console.log('produced buffer', packetBuff.toString('hex'))
      console.log('received length', buffer.length)
      console.log('produced length', packetBuff.length)
    }
  })
  targetClient.on('end', function () {
    endedTargetClient = true
    console.log('Connection closed by server', '(' + addr + ')')
    if (!endedClient) { client.end('End') }
  })
  targetClient.on('error', function (err) {
    endedTargetClient = true
    console.log('Connection error by server', '(' + addr + ') ', err)
    console.log(err.stack)
    if (!endedClient) { client.end('Error') }
  })
})

function shouldDump (name, direction) {
  if (matches(printNameBlacklist[name])) return false
  if (printAllNames) return true
  return matches(printNameWhitelist[name])

  function matches (result) {
    return result !== undefined && result !== null && result.indexOf(direction) !== -1
  }
}
