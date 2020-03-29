const { ProtoDef } = require('protodef-neo')
const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const protocols = new Map()

function createProtocol (state, direction, version, customPackets) {
  const key = state + ';' + direction + ';' + version
  if (protocols.has(key)) return protocols.get(key)
  const proto = new ProtoDef()
  proto.addTypes(minecraft)
  const mcData = require('minecraft-data')(version)
  proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
  protocols.set(key, proto)
  return proto
}

function createSerializer ({
  state = states.HANDSHAKING,
  isServer = false,
  version,
  customPackets
} = {}) {
  return createProtocol(
    state,
    isServer ? 'toClient' : 'toServer',
    version,
    customPackets
  ).createSerializer('packet')
}

function createDeserializer ({
  state = states.HANDSHAKING,
  isServer = false,
  version,
  customPackets
} = {}) {
  return createProtocol(
    state,
    isServer ? 'toServer' : 'toClient',
    version,
    customPackets
  ).createDeserializer('packet')
}

module.exports = {
  createSerializer: createSerializer,
  createDeserializer: createDeserializer
}
