'use strict'

const ProtoDef = require('@saiv46/protodef').ProtoDef
const Serializer = require('@saiv46/protodef').Serializer
const Parser = require('@saiv46/protodef').FullPacketParser
const { ProtoDefCompiler } = require('@saiv46/protodef').Compiler

const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const protocols = {}

function createProtocol (state, direction, version, customPackets, compiled = false) {
  const key = state + ';' + direction + ';' + version + (compiled ? ';c' : '')
  if (protocols[key]) { return protocols[key] }
  const mcData = require('minecraft-data')(version)

  if (compiled) {
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(require('../datatypes/compiler-minecraft'))
    compiler.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
    const proto = compiler.compileProtoDefSync()
    protocols[key] = proto
    return proto
  }

  const proto = new ProtoDef(false)
  proto.addTypes(minecraft)
  proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
  protocols[key] = proto
  return proto
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = false } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = false } = {}) {
  return new Parser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

module.exports = {
  createSerializer: createSerializer,
  createDeserializer: createDeserializer
}
