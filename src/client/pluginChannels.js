const ProtoDef = require('protodef').ProtoDef
const minecraft = require('../datatypes/minecraft')
const debug = require('debug')('minecraft-protocol')

module.exports = function (client, options) {
  const mcdata = require('minecraft-data')(options.version || require('../version').defaultVersion)
  const channels = []
  const proto = new ProtoDef()
  proto.addTypes(mcdata.protocol.types)
  proto.addTypes(minecraft)

  client.registerChannel = registerChannel
  client.unregisterChannel = unregisterChannel
  client.writeChannel = writeChannel

  if (options.protocolVersion >= 385) { // 1.13-pre3 (385) added Added Login Plugin Message (https://wiki.vg/Protocol_History#1.13-pre3)
    client.on('login_plugin_request', onLoginPluginRequest)
  }

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

  function onLoginPluginRequest (packet) {
    client.write('login_plugin_response', { // write that login plugin request is not understood, just like the Notchian client
      messageId: packet.messageId
    })
  }

  function writeChannel (channel, params) {
    debug('write custom payload ' + channel + ' ' + params)
    client.write('custom_payload', {
      channel: channel,
      data: (channel === 'REGISTER' || channel === 'UNREGISTER') ? Buffer.from(params) : proto.createPacketBuffer(channel, params)
    })
  }
}
