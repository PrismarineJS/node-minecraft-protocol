'use strict'

const ProtoDef = require('protodef').ProtoDef
const Serializer = require('protodef').Serializer
const Parser = require('protodef').FullPacketParser
const { ProtoDefCompiler } = require('protodef').Compiler

const nbt = require('prismarine-nbt')
const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const minecraftData = require('minecraft-data')
const protocols = {}

function createProtocol (state, direction, version, customPackets, compiled = true) {
  const key = state + ';' + direction + ';' + version + (compiled ? ';c' : '')
  if (protocols[key]) { return protocols[key] }

  const mcData = minecraftData(version)
  const versionInfo = minecraftData.versionsByMinecraftVersion.pc[version]
  if (mcData === null) {
    throw new Error(`No data available for version ${version}`)
  } else if (versionInfo && versionInfo.version !== mcData.version.version) {
    // The protocol version returned by node-minecraft-data constructor does not match the data in minecraft-data's protocolVersions.json
    throw new Error(`Do not have protocol data for protocol version ${versionInfo.version} (attempted to use ${mcData.version.version} data)`)
  }

  if (compiled) {
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(require('../datatypes/compiler-minecraft'))
    compiler.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
    nbt.addTypesToCompiler('big', compiler)
    const proto = compiler.compileProtoDefSync()
    protocols[key] = proto
    return proto
  }

  const proto = new ProtoDef(false)
  proto.addTypes(minecraft)
  proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
  nbt.addTypesToInterperter('big', proto)
  protocols[key] = proto
  return proto
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
  return new Parser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging)
}

module.exports = {
  createSerializer,
  createDeserializer
}
