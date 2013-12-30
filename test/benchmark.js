var ITERATIONS = 100000;

var Client = require('../lib/client'),
  EventEmitter = require('events').EventEmitter,
  util = require('util'),
  states = require('../lib/protocol').states;

var FakeSocket = function() {
  EventEmitter.call(this);
};
util.inherits(FakeSocket, EventEmitter);
FakeSocket.prototype.write = function(){};

var client = new Client();
var socket = new FakeSocket();
client.setSocket(socket);
client.state = states.PLAY;

var testDataWrite = [
  {id: 0x00, params: {keepAliveId: 957759560}},
  {id: 0x01, params: {message: '<Bob> Hello World!'}},
  {id: 0x06, params: {x: 6.5, y: 65.62, stance: 67.24, z: 7.5, yaw: 0, pitch: 0, onGround: true}},
  // TODO: add more packets for better quality data
];

var start, i, j;
console.log('Beginning write test');
start = Date.now();
for(i = 0; i < ITERATIONS; i++) {
  for(j = 0; j < testDataWrite.length; j++) {
    client.write(testDataWrite[j].id, testDataWrite[j].params);
  }
}
console.log('Finished write test in ' + (Date.now() - start) / 1000 + ' seconds');

var testDataRead = [
  {id: 0x00, params: {keepAliveId: 957759560}},
  {id: 0x02, params: {message: '<Bob> Hello World!'}},
  {id: 0x08, params: {x: 6.5, y: 65.62, stance: 67.24, z: 7.5, yaw: 0, pitch: 0, onGround: true}},
];

client.isServer = true;

var inputData = new Buffer(0);
socket.write = function(data) {
  inputData = Buffer.concat([inputData, data]);
};
for(i = 0; i < testDataRead.length; i++) {
  client.write(testDataRead[i].id, testDataRead[i].params);
}

client.isServer = false;

console.log('Beginning read test');
start = Date.now();
for(i = 0; i < ITERATIONS; i++) {
  socket.emit('data', inputData);
}
console.log('Finished read test in ' + (Date.now() - start) / 1000 + ' seconds');
