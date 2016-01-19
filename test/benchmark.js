var ITERATIONS = 1000;

var mc = require("minecraft-protocol");
var util = require('util');
var states = mc.states;

var testDataWrite = [
  {name: 'keep_alive', params: {keepAliveId: 957759560}},
  {name: 'chat', params: {message: '<Bob> Hello World!'}},
  {name: 'position_look', params: {x: 6.5, y: 65.62, stance: 67.24, z: 7.5, yaw: 0, pitch: 0, onGround: true}}
  // TODO: add more packets for better quality data
];

mc.supportedVersions.forEach(function(supportedVersion){
  var mcData=require("minecraft-data")(supportedVersion);
  var version=mcData.version;
  describe("benchmark "+version.minecraftVersion,function(){
    this.timeout(60 * 1000);
    var inputData = [];
    it("bench serializing",function(done){
      var serializer=new mc.createSerializer({state:states.PLAY,isServer:false,version:version.majorVersion});
      var start, i, j;
      console.log('Beginning write test');
      start = Date.now();
      for(i = 0; i < ITERATIONS; i++) {
        for(j = 0; j < testDataWrite.length; j++) {
          serializer.write(testDataWrite[j]);
        }
      }
      serializer.end();
      serializer.on("data",function(data) {
        inputData.push(data);
      });
      serializer.on('finish',function(){
        console.log('Finished write test in ' + (Date.now() - start) / 1000 + ' seconds');
        done();
      });
    });

    it("bench parsing",function(done){
      var deserializer=new mc.createDeserializer({state:states.PLAY,isServer:true,version:version.majorVersion});
      console.log('Beginning read test');
      var start = Date.now();

      inputData.forEach(function(data) {deserializer.write(data)});
      deserializer.end();
      deserializer.on('finish',function(){
        console.log('Finished read test in ' + (Date.now() - start) / 1000 + ' seconds');
        done();
      });
    });
  });
});
