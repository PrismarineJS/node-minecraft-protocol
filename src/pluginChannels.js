var Duplex = require('readable-stream').Duplex;

module.exports = function(client, options) {
  let channelCache = new Set();

  class PluginChannelStream extends Duplex {
    constructor(name) {
      super();
      this.name = name;
      this.readStuff = [];

      client.on('custom_payload', (data) => {
        if (data.channel === "stuff")
          this.readStuff.push(data);
      });
    }

    _write(chunk, encoding, cb) {
      client.write('custom_payload', {
        channel: name,
        data: data
      });
      cb(null); // sync
    }

    _read() {
      // First, read everything currently in the cache.
      var areWeDone = false;
      while (this.readStuff.length > 0 && areWeDone) {
        areWeDone = this.push(this.readStuff.unshift());
      }
      // If we want more, wait until we get more
      if (!areWeDone)
        client.on('custom_payload', (data) => {
           // When push returns false, we should stop reading until _read is called again.
          if (!this.push(this.readStuff.unshift()))
            client.removeEventListener('custom_payload', bleh);
        });
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
