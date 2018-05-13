const ProtoDef = require('protodef').ProtoDef
const minecraft = require('../datatypes/minecraft')
const debug = require('debug')('minecraft-protocol')

module.exports = function (client, options) {
  const mcdata = require('minecraft-data')(options.version || require('../version').defaultVersion)
  const channels = []
  const proto = new ProtoDef()
  proto.addTypes(mcdata.protocol.types)
  proto.addTypes(minecraft)
  proto.addType('registerarr', [readDumbArr, writeDumbArr, sizeOfDumbArr])

  client.registerChannel = registerChannel
  client.unregisterChannel = unregisterChannel
  client.writeChannel = writeChannel

  client.registerChannel('REGISTER', ['registerarr', []])
  client.registerChannel('UNREGISTER', ['registerarr', []])

  function registerChannel (name, parser, custom) {
    if (custom) {
      client.writeChannel('REGISTER', name)
    }
    if (parser) proto.addType(name, parser)
    channels.push(name)
    if (channels.length === 1) { client.on('custom_payload', onCustomPayload) }
  }

  function unregisterChannel (channel, custom) {
    if (custom) {
      client.writeChannel('UNREGISTER', channel)
    }
    const index = channels.find(function (name) {
      return channel === name
    })
    if (index) {
      proto.types[channel] = undefined
      channels.splice(index, 1)
      if (channels.length === 0) { client.removeListener('custom_payload', onCustomPayload) }
    }
  }

  function onCustomPayload (packet) {
    const channel = channels.find(function (channel) {
      return channel === packet.channel
    })
    if (channel) {
      if (proto.types[channel]) { packet.data = proto.parsePacketBuffer(channel, packet.data).data }
      debug('read custom payload ' + channel + ' ' + packet.data)
      client.emit(channel, packet.data)
    }
  }

  function writeChannel (channel, params) {
    debug('write custom payload ' + channel + ' ' + params)
    client.write('custom_payload', {
      channel: channel,
      data: proto.createPacketBuffer(channel, params)
    })
  }

  function readDumbArr (buf, offset) {
    const ret = {
      value: [],
      size: 0
    }
    let results
    while (offset < buf.length) {
      if (buf.indexOf(0x0, offset) === -1) { results = this.read(buf, offset, 'restBuffer', {}) } else { results = this.read(buf, offset, 'cstring', {}) }
      ret.size += results.size
      ret.value.push(results.value.toString())
      offset += results.size
    }
    return ret
  }

  function writeDumbArr (value, buf, offset) {
    // TODO: Remove trailing \0
    value.forEach(function (v) {
      offset += this.write(v, buf, offset, 'cstring', {})
    })
    return offset
  }

  function sizeOfDumbArr (value) {
    return value.reduce((acc, v) => acc + this.sizeOf(v, 'cstring', {}), 0)
  }
}
