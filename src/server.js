import net from 'net';
import { EventEmitter } from 'events';
import Client from './client';
import states from "./states";

class Server extends EventEmitter
{
  constructor(version,customPackets) {
    super();
    this.version=version;
    this.socketServer=null;
    this.cipher=null;
    this.decipher=null;
    this.clients={};
    this.customPackets=customPackets;
  }

  listen(port, host) {
    const self = this;
    let nextId = 0;
    self.socketServer = net.createServer();
    self.socketServer.on('connection', socket => {
      const client = new Client(true,this.version,this.customPackets);
      client._end = client.end;
      client.end = function end(endReason) {
        endReason=`{"text":"${endReason}"}`;
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
    Object.keys(this.clients).forEach(clientId => {
      const client = this.clients[clientId];
      client.end('ServerShutdown');
    });
    this.socketServer.close();
  }
}

export default Server;
