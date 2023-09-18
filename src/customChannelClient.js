'use strict'
const EventEmitter = require('events').EventEmitter
const debug = require('debug')('minecraft-protocol')
const states = require('./states')

class CustomChannelClient extends EventEmitter {
  constructor (isServer, version, customCommunication) {
    super()
    this.customCommunication = customCommunication
    this.version = version
    this.isServer = !!isServer
    this.state = states.HANDSHAKING
  }

  get state () {
    return this.protocolState
  }

  setSerializer (state) {
    this.customCommunication.receiverSetup.call(this, (/** @type {{name, params, state?}} */parsed) => {
      debug(`receive in ${this.isServer ? 'server' : 'client'}: ${parsed.name}`)
      this.emit(parsed.name, parsed.params, parsed)
      this.emit('packet_name', parsed.name, parsed.params, parsed)
    })
  }

  set state (newProperty) {
    const oldProperty = this.protocolState
    this.protocolState = newProperty

    this.setSerializer(this.protocolState)

    this.emit('state', newProperty, oldProperty)
  }

  end (reason) {
    this._endReason = reason
  }

  write (name, params) {
    debug(`[${this.state}] from ${this.isServer ? 'server' : 'client'}: ` + name)
    debug(params)

    if (this.customCommunication) {
      this.customCommunication.sendData.call(this, { name, params, state: this.state })
    } else {
      this.serializer.write({ name, params })
    }
  }

  writeBundle (packets) {
    // no-op
  }

  writeRaw (buffer) {
    // no-op
  }
}

module.exports = CustomChannelClient
