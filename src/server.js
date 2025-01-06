'use strict'

const net = require('net')
const EventEmitter = require('events').EventEmitter
const Client = require('./client')
const states = require('./states')
const { createSerializer } = require('./transforms/serializer')

class Server extends EventEmitter {
  constructor (version, customPackets, hideErrors = false) {
    super()
    this.version = version
    this.socketServer = null
    this.cipher = null
    this.decipher = null
    this.clients = {}
    this.customPackets = customPackets
    this.hideErrors = hideErrors
    this.serializer = createSerializer({ state: 'play', isServer: true, version, customPackets })
  }

  listen (port, host) {
    const self = this
    let nextId = 0
    self.socketServer = net.createServer()
    self.socketServer.on('connection', socket => {
      const client = new Client(true, this.version, this.customPackets, this.hideErrors)
      client._end = client.end
      client.end = function end (endReason, fullReason = JSON.stringify({ text: endReason })) {
        if (client.state === states.PLAY) {
          client.write('kick_disconnect', { reason: fullReason })
        } else if (client.state === states.LOGIN) {
          client.write('disconnect', { reason: fullReason })
        }
        client._end(endReason)
      }
      client.id = nextId++
      self.clients[client.id] = client
      client.on('end', function () {
        delete self.clients[client.id]
      })
      client.setSocket(socket)
      self.emit('connection', client)
    })
    self.socketServer.on('error', function (err) {
      self.emit('error', err)
    })
    self.socketServer.on('close', function () {
      self.emit('close')
    })
    self.socketServer.on('listening', function () {
      self.emit('listening')
    })
    self.socketServer.listen(port, host)
  }

  close () {
    Object.keys(this.clients).forEach(clientId => {
      const client = this.clients[clientId]
      client.end('ServerShutdown')
    })
    this.socketServer.close()
  }

  writeToClients (clients, name, params) {
    if (clients.length === 0) return
    const buffer = this.serializer.createPacketBuffer({ name, params })
    clients.forEach(client => client.writeRaw(buffer))
  }
}

module.exports = Server
