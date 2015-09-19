var ITERATIONS = 100000;

var mc = require("../");
  util = require('util'),
  states = mc.states;

var testDataWrite = [
  {name: 'keep_alive', params: {keepAliveId: 957759560}},
  {name: 'chat', params: {message: '<Bob> Hello World!'}},
  {name: 'position_look', params: {x: 6.5, y: 65.62, stance: 67.24, z: 7.5, yaw: 0, pitch: 0, onGround: true}},
  // TODO: add more packets for better quality data
];

var inputData = [];

var start, i, j;
console.log('Beginning write test');
start = Date.now();
for(i = 0; i < ITERATIONS; i++) {
  for(j = 0; j < testDataWrite.length; j++) {
    inputData.push(mc.createPacketBuffer(testDataWrite[j].name, states.PLAY, testDataWrite[j].params, false));
  }
}
console.log('Finished write test in ' + (Date.now() - start) / 1000 + ' seconds');

console.log('Beginning read test');
start = Date.now();
for (j = 0; j < inputData.length; j++) {
  mc.parsePacketData(inputData[j], states.PLAY, true);
}
console.log('Finished read test in ' + (Date.now() - start) / 1000 + ' seconds');
