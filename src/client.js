'use strict'
const EventEmitter = require('events').EventEmitter
const debug = require('debug')('minecraft-protocol')
const compression = require('./transforms/compression')
const framing = require('./transforms/framing')
const states = require('./states')

const createSerializer = require('./transforms/serializer').createSerializer
const createDeserializer = require('./transforms/serializer').createDeserializer
const createCipher = require('./transforms/encryption').createCipher
const createDecipher = require('./transforms/encryption').createDecipher

const closeTimeout = 30 * 1000

class Client extends EventEmitter {
  constructor (isServer, version, customPackets, hideErrors = false) {
    super()
    this.customPackets = customPackets
    this.version = version
    this.isServer = !!isServer
    this.splitter = framing.createSplitter()
    this.packetsToParse = {}
    this.compressor = null
    this.framer = framing.createFramer()
    this.cipher = null
    this.decipher = null
    this.decompressor = null
    this.ended = true
    this.latency = 0
    this.hideErrors = hideErrors
    this.closeTimer = null
    const mcData = require('minecraft-data')(version)
    this.state = states.HANDSHAKING
    this._hasBundlePacket = mcData.supportFeature('hasBundlePacket')
  }

  get state () {
    return this.protocolState
  }

  setSerializer (state) {
    this.serializer = createSerializer({ isServer: this.isServer, version: this.version, state, customPackets: this.customPackets })
    this.deserializer = createDeserializer({
      isServer: this.isServer,
      version: this.version,
      state,
      packetsToParse:
      this.packetsToParse,
      customPackets: this.customPackets,
      noErrorLogging: this.hideErrors
    })

    this.splitter.recognizeLegacyPing = state === states.HANDSHAKING

    this.serializer.on('error', (e) => {
      let parts
      if (e.field) {
        parts = e.field.split('.')
        parts.shift()
      } else { parts = [] }
      const serializerDirection = !this.isServer ? 'toServer' : 'toClient'
      e.field = [this.protocolState, serializerDirection].concat(parts).join('.')
      e.message = `Serialization error for ${e.field} : ${e.message}`
      if (!this.compressor) { this.serializer.pipe(this.framer) } else { this.serializer.pipe(this.compressor) }
      this.emit('error', e)
    })

    this.deserializer.on('error', (e) => {
      let parts
      if (e.field) {
        parts = e.field.split('.')
        parts.shift()
      } else { parts = [] }
      const deserializerDirection = this.isServer ? 'toServer' : 'toClient'
      e.field = [this.protocolState, deserializerDirection].concat(parts).join('.')
      e.message = `Deserialization error for ${e.field} : ${e.message}`
      if (!this.compressor) { this.splitter.pipe(this.deserializer) } else { this.decompressor.pipe(this.deserializer) }
      this.emit('error', e)
    })
    this._mcBundle = []
    const emitPacket = (parsed) => {
      this.emit('packet', parsed.data, parsed.metadata, parsed.buffer, parsed.fullBuffer)
      this.emit(parsed.metadata.name, parsed.data, parsed.metadata)
      this.emit('raw.' + parsed.metadata.name, parsed.buffer, parsed.metadata)
      this.emit('raw', parsed.buffer, parsed.metadata)
    }
    this.deserializer.on('data', (parsed) => {
      parsed.metadata.name = parsed.data.name
      parsed.data = parsed.data.params
      parsed.metadata.state = state
      debug('read packet ' + state + '.' + parsed.metadata.name)
      if (debug.enabled) {
        const s = JSON.stringify(parsed.data, null, 2)
        debug(s && s.length > 10000 ? parsed.data : s)
      }
      if (this._hasBundlePacket && parsed.metadata.name === 'bundle_delimiter') {
        if (this._mcBundle.length) { // End bundle
          this._mcBundle.forEach(emitPacket)
          emitPacket(parsed)
          this._mcBundle = []
        } else { // Start bundle
          this._mcBundle.push(parsed)
        }
      } else if (this._mcBundle.length) {
        this._mcBundle.push(parsed)
        if (this._mcBundle.length > 32) {
          this._mcBundle.forEach(emitPacket)
          this._mcBundle = []
          this._hasBundlePacket = false
        }
      } else {
        emitPacket(parsed)
      }
    })
  }

  set state (newProperty) {
    const oldProperty = this.protocolState
    this.protocolState = newProperty

    if (this.serializer) {
      if (!this.compressor) {
        this.serializer.unpipe()
        this.splitter.unpipe(this.deserializer)
      } else {
        this.serializer.unpipe(this.compressor)
        this.decompressor.unpipe(this.deserializer)
      }

      this.serializer.removeAllListeners()
      this.deserializer.removeAllListeners()
    }
    this.setSerializer(this.protocolState)

    if (!this.compressor) {
      this.serializer.pipe(this.framer)
      this.splitter.pipe(this.deserializer)
    } else {
      this.serializer.pipe(this.compressor)
      if (globalThis.debugNMP) this.decompressor.on('data', (data) => { console.log('DES>', data.toString('hex')) })
      this.decompressor.pipe(this.deserializer)
    }

    this.emit('state', newProperty, oldProperty)
  }

  get compressionThreshold () {
    return this.compressor == null ? -2 : this.compressor.compressionThreshold
  }

  set compressionThreshold (threshold) {
    this.setCompressionThreshold(threshold)
  }

  setSocket (socket) {
    this.ended = false

    // TODO : A lot of other things needs to be done.
    const endSocket = () => {
      if (this.ended) return
      this.ended = true
      clearTimeout(this.closeTimer)
      this.socket.removeListener('close', endSocket)
      this.socket.removeListener('end', endSocket)
      this.socket.removeListener('timeout', endSocket)
      this.emit('end', this._endReason || 'socketClosed')
    }

    const onFatalError = (err) => {
      this.emit('error', err)
      endSocket()
    }

    const onError = (err) => this.emit('error', err)

    this.socket = socket

    if (this.socket.setNoDelay) { this.socket.setNoDelay(true) }

    this.socket.on('connect', () => this.emit('connect'))

    this.socket.on('error', onFatalError)
    this.socket.on('close', endSocket)
    this.socket.on('end', endSocket)
    this.socket.on('timeout', endSocket)
    this.framer.on('error', onError)
    this.splitter.on('error', onError)

    this.socket.pipe(this.splitter)
    this.framer.pipe(this.socket)
  }

  end (reason) {
    this._endReason = reason
    /* ending the serializer will end the whole chain
    serializer -> framer -> socket -> splitter -> deserializer */
    if (this.serializer) {
      this.serializer.end()
    } else {
      if (this.socket) this.socket.end()
    }
    if (this.socket) {
      this.closeTimer = setTimeout(
        this.socket.destroy.bind(this.socket),
        closeTimeout
      )
    }
  }

  setEncryption (sharedSecret) {
    if (this.cipher != null) { this.emit('error', new Error('Set encryption twice!')) }
    this.cipher = createCipher(sharedSecret)
    this.cipher.on('error', (err) => this.emit('error', err))
    this.framer.unpipe(this.socket)
    this.framer.pipe(this.cipher).pipe(this.socket)
    this.decipher = createDecipher(sharedSecret)
    this.decipher.on('error', (err) => this.emit('error', err))
    this.socket.unpipe(this.splitter)
    this.socket.pipe(this.decipher).pipe(this.splitter)
  }

  setCompressionThreshold (threshold) {
    if (this.compressor == null) {
      this.compressor = compression.createCompressor(threshold)
      this.compressor.on('error', (err) => this.emit('error', err))
      this.serializer.unpipe(this.framer)
      this.serializer.pipe(this.compressor).pipe(this.framer)
      this.decompressor = compression.createDecompressor(threshold, this.hideErrors)
      this.decompressor.on('error', (err) => this.emit('error', err))
      this.splitter.unpipe(this.deserializer)
      this.splitter.pipe(this.decompressor).pipe(this.deserializer)
    } else {
      this.decompressor.threshold = threshold
      this.compressor.threshold = threshold
    }
  }

  write (name, params) {
    if (!this.serializer.writable) { return }
    debug('writing packet ' + this.state + '.' + name)
    debug(params)
    this.serializer.write({ name, params })
  }

  writeBundle (packets) {
    if (this._hasBundlePacket) this.write('bundle_delimiter', {})
    for (const [name, params] of packets) this.write(name, params)
    if (this._hasBundlePacket) this.write('bundle_delimiter', {})
  }

  writeRaw (buffer) {
    const stream = this.compressor === null ? this.framer : this.compressor
    if (!stream.writable) { return }
    stream.write(buffer)
  }

  // TCP/IP-specific (not generic Stream) method for backwards-compatibility
  connect (port, host) {
    const options = { port, host }
    if (!this.options) this.options = options
    require('./client/tcp_dns')(this, options)
    options.connect(this)
  }
}

module.exports = Client
