'use strict';

const ProtoDef = require("protodef").ProtoDef;
const Serializer = require("protodef").Serializer;
const Parser = require("protodef").Parser;

const minecraft = require("../datatypes/minecraft");
const states = require("../states");
const merge=require("lodash.merge");
const get=require("lodash.get");

function recursiveAddTypes(protocol,protocolData,path)
{
  if(protocolData===undefined)
    return;
  if(protocolData.types)
    protocol.addTypes(protocolData.types);
  recursiveAddTypes(protocol,get(protocolData,path.shift()),path);
}

function createProtocol(state,direction,version,customPackets)
{
  const proto = new ProtoDef();
  proto.addTypes(minecraft);
  const mcData=require("minecraft-data")(version);
  recursiveAddTypes(proto,merge(mcData.protocol,get(customPackets,[mcData.version.majorVersion])),[state,direction]);
  return proto;
}

function createSerializer({ state = states.HANDSHAKING, isServer = false , version,customPackets} = {})
{
  return new Serializer(createProtocol(state,!isServer ? "toServer" : "toClient",version,customPackets),"packet");
}

function createDeserializer({ state = states.HANDSHAKING, isServer = false,version,customPackets } = {})
{
  return new Parser(createProtocol(state,isServer ? "toServer" : "toClient",version,customPackets),"packet");
}

module.exports = {
  createSerializer:createSerializer,
  createDeserializer:createDeserializer
};
