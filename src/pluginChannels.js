var EventEmitter = require('events').EventEmitter;

function serializeChannelList(channels) {
  return new Buffer(channels.join('\0'));
}

function parseChannelList(buffer) {
  return buffer.toString().split('\0');
}

class PluginChannels extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.channels = new Set();
  }
}

class IncomingPluginChannels extends PluginChannels {
  constructor(client) {
    super(client);

    client.on('custom_payload', (packet) => {
      client.incomingPluginChannels.emit(packet.channel, packet.data);

      if (packet.channel === 'REGISTER') {
        parseChannelList(packet.data).forEach((channel) => {
          this.channels.add(channel);
        });
      } else if (packet.channel === 'UNREGISTER') {
        parseChannelList(packet.data).forEach((channel) => {
          this.channels.delete(channel);
        });
      }
    });
  }
}

class OutgoingPluginChannels extends PluginChannels {
  constructor(client) {
    super(client);
  }

  write(channel, data) {
    this.client.write('custom_payload', {
      channel: channel,
      data: data
    });
  }

  register(...channels) {
    this.write('REGISTER', serializeChannelList(channels));
    this.channels.forEach((channel) => {
      this.channels.add(channel);
    });
  }

  unregister(...channels) {
    this.write('UNREGISTER', serializeChannelList(channels));
    this.channels.forEach((channel) => {
      this.channels.delete(channel);
    });
  }
}

module.exports = {
  IncomingPluginChannels,
  OutgoingPluginChannels
};
