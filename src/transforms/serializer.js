'use strict'

const ProtoDef = require('protodef').ProtoDef
const Serializer = require('protodef').Serializer
const Parser = require('protodef').FullPacketParser
const { ProtoDefCompiler } = require('protodef').Compiler

const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const protocols = {}

function createProtocol (state, direction, version, customPackets) {
  const key = state + ';' + direction + ';' + version
  if (protocols[key]) { return protocols[key] }
  const mcData = require('minecraft-data')(version)

  if (mcData.version.majorVersion === '1.7') {
    const proto = new ProtoDef(false)
    proto.addTypes(minecraft)
    proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
    protocols[key] = proto
    return proto
  }

  const compiler = new ProtoDefCompiler()
  compiler.addTypes(require('../datatypes/nbt-compound'))
  compiler.addTypesToCompile(require('../datatypes/nbt.json'))
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
  const proto = compiler.compileProtoDefSync()
  protocols[key] = proto
  return proto
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets } = {}) {
  return new Parser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets), 'packet')
}

module.exports = {
  createSerializer: createSerializer,
  createDeserializer: createDeserializer
}
