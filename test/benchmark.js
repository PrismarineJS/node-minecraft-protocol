var ITERATIONS = 1000000;

var Client = require('../lib/client'),
  EventEmitter = require('events').EventEmitter,
  util = require('util');

var FakeSocket = function() {
  EventEmitter.call(this);
};
util.inherits(FakeSocket, EventEmitter);
FakeSocket.prototype.write = function(){};

var client = new Client();
var socket = new FakeSocket();
client.setSocket(socket);

var testData = [
  {id: 0x0, params: {keepAliveId: 957759560}},
  {id: 0x3, params: {message: '<Bob> Hello World!'}},
  {id: 0xd, params: {x: 6.5, y: 65.62, stance: 67.24, z: 7.5, yaw: 0, pitch: 0, onGround: true}},
  {id: 0xe, params: {status: 1, x: 32, y: 64, z: 32, face: 3}}
  // TODO: add more packets for better quality data
];

var start, i, j;
console.log('Beginning write test');
start = Date.now();
for(i = 0; i < ITERATIONS; i++) {
  for(j = 0; j < testData.length; j++) {
    client.write(testData[j].id, testData[j].params);
  }
}
console.log('Finished write test in ' + (Date.now() - start) / 1000 + ' seconds');

var inputData = new Buffer(0);
socket.write = function(data) {
  inputData = Buffer.concat([inputData, data]);
};
for(i = 0; i < testData.length; i++) {
  client.write(testData[i].id, testData[i].params);
}

console.log('Beginning read test');
start = Date.now();
for(i = 0; i < ITERATIONS; i++) {
  socket.emit('data', inputData);
}
console.log('Finished read test in ' + (Date.now() - start) / 1000 + ' seconds');
