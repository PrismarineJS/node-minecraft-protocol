var Duplex = require('readable-stream').Duplex;

module.exports = function(client, options) {
  let channelCache = new Set();

  class PluginChannelStream extends Duplex {
    constructor(name) {
      super();
      this.name = name;
    }

    _write(chunk, encoding, cb) {
      client.write('custom_payload', {
        channel: name,
        data: data
      });
      cb(null); // sync
    }

    _read() {
      //TODO
      /*
      client.on('custom_payload', (packet) => {
      client.incomingPluginChannels.emit(packet.channel, packet.data);
      */
    }
  }


  client.pluginChannel = (name) => {
    if (channelCache[name]) {
      return channelCache[name];
    }

    let channel = new PluginChannelStream();
    channelCache[name] = channel;
    return channel;
  };
};
