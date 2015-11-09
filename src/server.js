var net = require('net');
var EventEmitter = require('events').EventEmitter;
var Client = require('./client');
var states = require("./states");

class Server extends EventEmitter
{
  socketServer=null;
  cipher=null;
  decipher=null;
  clients={};

  constructor(version) {
    super();
    this.version=version;
  }

  listen(port, host) {
    var self = this;
    var nextId = 0;
    self.socketServer = net.createServer();
    self.socketServer.on('connection', socket => {
      var client = new Client(true,this.version);
      client._end = client.end;
      client.end = function end(endReason) {
        endReason='{"text":"'+endReason+'"}';
        if(client.state === states.PLAY) {
          client.write('kick_disconnect', {reason: endReason});
        } else if(client.state === states.LOGIN) {
          client.write('disconnect', {reason: endReason});
        }
        client._end(endReason);
      };
      client.id = nextId++;
      self.clients[client.id] = client;
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
  }

  close() {
    var client;
    for(var clientId in this.clients) {
      if(!this.clients.hasOwnProperty(clientId)) continue;

      client = this.clients[clientId];
      client.end('ServerShutdown');
    }
    this.socketServer.close();
  }
}

module.exports = Server;
