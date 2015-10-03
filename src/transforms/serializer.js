var ProtoDef = require("protodef").ProtoDef;
var Serializer = require("protodef").Serializer;
var Parser = require("protodef").Parser;

var minecraft = require("../datatypes/minecraft");
var states = require("../states");

function createProtocol(types,packets)
{
  var proto = new ProtoDef();
  proto.addType("string",["pstring",{
    countType:"varint"
  }]);
  proto.addTypes(minecraft);
  proto.addTypes(types);

  Object.keys(packets).forEach(function(name) {
    proto.addType("packet_"+name,["container",packets[name].fields]);
  });

  proto.addType("packet",["container", [
    { "name": "name", "type":["mapper",{"type": "varint" ,
      "mappings":Object.keys(packets).reduce(function(acc,name){
        acc[parseInt(packets[name].id)]=name;
        return acc;
      },{})
    }]},
    { "name": "params", "type": ["switch", {
      "compareTo": "name",
      "fields": Object.keys(packets).reduce(function(acc,name){
        acc[name]="packet_"+name;
        return acc;
      },{})
    }]}
  ]]);
  return proto;
}

function createSerializer({ state = states.HANDSHAKING, isServer = false , version} = {})
{
  var mcData=require("minecraft-data")(version);
  var direction = !isServer ? 'toServer' : 'toClient';
  var packets = mcData.protocol.states[state][direction];
  var proto=createProtocol(mcData.protocol.types,packets);
  return new Serializer(proto,"packet");
}

function createDeserializer({ state = states.HANDSHAKING, isServer = false,
  packetsToParse = {"packet": true}, version } = {})
{
  var mcData=require("minecraft-data")(version);
  var direction = isServer ? "toServer" : "toClient";
  var packets = mcData.protocol.states[state][direction];
  var proto=createProtocol(mcData.protocol.types,packets);
  return new Parser(proto,"packet");
}

module.exports = {
  createSerializer:createSerializer,
  createDeserializer:createDeserializer
};
