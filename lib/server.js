var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , assert = require('assert')
  , Client = require('./client')

module.exports = Server;

function Server(options) {
  EventEmitter.call(this);

  this.maxPlayers = options['max-players'] || 20;
  this.playerCount = 0

  this.socket = null;
  this.cipher = null;
  this.decipher = null;
}
util.inherits(Server, EventEmitter);

Server.prototype.listen = function(port, host) {
  var self = this;
  self.socket = net.createServer();
  self.socket.on('connection', function(socket) {
    var client = new Client({
      isServer: true,
    });
    client.on('error', function(err) {
      self.emit('error', err);
    });
    client.setSocket(socket);
    self.emit('connection', client);
    client.on('end', function() {
      this.playerCount -= 1;
    });
    this.playerCount += 1;
  });
  self.socket.on('error', function(err) {
    self.emit('error', err);
  });
  self.socket.on('close', function() {
    self.emit('end');
  });
  self.socket.on('listening', function() {
    self.emit('listening');
  });
  self.socket.listen(port, host);
};
