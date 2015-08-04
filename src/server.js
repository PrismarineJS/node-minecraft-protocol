var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , Client = require('./client')
  , states = require('./transforms/serializer').states
  ;

module.exports = Server;

function Server() {
  EventEmitter.call(this);

  this.socketServer = null;
  this.cipher = null;
  this.decipher = null;
  this.clients = {};
}
util.inherits(Server, EventEmitter);

Server.prototype.listen = function(port, host) {
  var self = this;
  var nextId = 0;
  self.socketServer = net.createServer();
  self.socketServer.on('connection', function(socket) {
    var client = new Client(true);
    client._end = client.end;
    client.end = function end(endReason) {
      endReason='{"text":"'+endReason+'"}';
      if(client.state === states.PLAY) {
        client.write(0x40, {reason: endReason});
      } else if(client.state === states.LOGIN) {
        client.write(0x00, {reason: endReason});
      }
      client._end(endReason);
    };
    client.id = nextId++;
    self.clients[client.id] = client;
    client.on('error', function(err) {
      self.emit('error', err);
    });
    client.on('end', function() {
      delete self.clients[client.id];
    });
    client.setSocket(socket);
    self.emit('connection', client);
  });
  self.socketServer.on('error', function(err) {
    self.emit('error', err);
  });
  self.socketServer.on('close', function() {
    self.emit('close');
  });
  self.socketServer.on('listening', function() {
    self.emit('listening');
  });
  self.socketServer.listen(port, host);
};

Server.prototype.close = function() {
  var client;
  for(var clientId in this.clients) {
    if(!this.clients.hasOwnProperty(clientId)) continue;

    client = this.clients[clientId];
    client.end('ServerShutdown');
  }
  this.socketServer.close();
};
