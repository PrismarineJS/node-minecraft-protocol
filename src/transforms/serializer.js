'use strict'

const { ProtoDef, Serializer, FullPacketParser } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler

const nbt = require('prismarine-nbt')
const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')

const minecraftData = require('minecraft-data')
const protocols = {}

// The generated code is fully determined by these versions plus the protocol
// key and customPackets, so together they make a stale cache file unreachable.
function protocolCacheFile (state, direction, version, customPackets) {
  const cacheDir = process.env.NMP_PROTOCOL_CACHE_DIR ??
    require('path').join(require('os').tmpdir(), 'node-minecraft-protocol-cache')
  if (cacheDir === '0') return null
  const inputs = [
    require('../../package.json').version,
    require('protodef/package.json').version,
    require('minecraft-data/package.json').version,
    JSON.stringify(customPackets ?? {})
  ].join(';')
  const hash = require('crypto').createHash('sha1').update(inputs).digest('hex').slice(0, 12)
  const name = `${version}-${state}-${direction}-${hash}.js`.replace(/[^a-zA-Z0-9.-]/g, '_')
  return require('path').join(cacheDir, name)
}

function createProtocol (state, direction, version, customPackets, compiled = true) {
  const key = `${state};${direction};${version}${compiled ? ';c' : ''}`
  if (protocols[key]) { return protocols[key] }

  const mcData = minecraftData(version)
  const versionInfo = minecraftData.versionsByMinecraftVersion.pc[version]
  if (mcData === null) {
    throw new Error(`No data available for version ${version}`)
  } else if (versionInfo && versionInfo.version !== mcData.version.version) {
    // The protocol version returned by node-minecraft-data constructor does not match the data in minecraft-data's protocolVersions.json
    throw new Error(`Unsupported protocol version '${versionInfo.version}' (attempted to use '${mcData.version.version}' data); try updating your packages with 'npm update'`)
  }

  if (compiled) {
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(require('../datatypes/compiler-minecraft'))
    nbt.addTypesToCompiler('big', compiler)
    const cacheFile = protocolCacheFile(state, direction, version, customPackets)
    let proto
    if (cacheFile) {
      // A hit also skips loading mcData.protocol and walking it in
      // addProtocol, which cost as much as the compile itself.
      try { proto = compiler.loadCompiledProtoDefSync(cacheFile) } catch {}
    }
    if (!proto) {
      const mergedProtocol = merge(mcData.protocol, customPackets?.[mcData.version.majorVersion] ?? {})
      compiler.addProtocol(mergedProtocol, [state, direction])
      // Registered a second time: the nbt schemas must override the types the
      // protocol declares as native (the pre-cache call above only provides
      // the natives needed to load a cached protocol).
      nbt.addTypesToCompiler('big', compiler)
      proto = compiler.compileProtoDefSync(cacheFile ? { cacheFile } : {})
    }
    protocols[key] = proto
    return proto
  }

  const mergedProtocol = merge(mcData.protocol, customPackets?.[mcData.version.majorVersion] ?? {})
  const proto = new ProtoDef(false)
  proto.addTypes(minecraft)
  proto.addProtocol(mergedProtocol, [state, direction])
  nbt.addTypesToInterperter('big', proto)
  protocols[key] = proto
  return proto
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
  return new FullPacketParser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging)
}

module.exports = {
  createSerializer,
  createDeserializer
}
