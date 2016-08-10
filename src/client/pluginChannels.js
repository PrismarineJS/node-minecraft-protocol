var ProtoDef = require('protodef').ProtoDef;
var minecraft = require('../datatypes/minecraft');

module.exports = function(client, options) {
  var mcdata = require('minecraft-data')(options.version || require("../version").defaultVersion);
  var channels = [];
  var proto = new ProtoDef();
  proto.addTypes(mcdata.protocol.types);
  proto.addTypes(minecraft);
  client.registerChannel = registerChannel;
  client.unregisterChannel = unregisterChannel;
  client.writeChannel = writeChannel;


  function registerChannel(name, parser) {
    if (parser) proto.addType(name, parser);
    channels.push(name);
    if (channels.length === 1)
      client.on('custom_payload', onCustomPayload);
  }

  function unregisterChannel(channel) {
    var index = channels.find(function(name) {
      return channel === name;
    });
    if (index) {
      proto.types[channel] = undefined;
      channels.splice(index, 1);
      if (channels.length === 0)
        client.removeListener('custom_payload', onCustomPayload);
    }
  }

  function onCustomPayload(packet) {
    var channel = channels.find(function(channel) {
      return channel === packet.channel;
    });
    if (channel) {
      if (proto.types[channel])
        packet.data = proto.parsePacketBuffer(channel, packet.data).data;
      client.emit(channel, packet.data);
    }
  }

  function writeChannel(channel,params) {
    client.write("custom_payload",{
        channel:channel,
        data:proto.createPacketBuffer(channel,params)
      });
  }
};

