var EventEmitter = require('events').EventEmitter;

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
}

module.exports = {
  IncomingPluginChannels,
  OutgoingPluginChannels
};
