'use strict'

const Client = require('./client')
const serializer = require('./transforms/serializer')
const createClient = require('./createClient')

module.exports = {
  createClient,
  // Getters so client-only consumers never load the server dependency
  // tree (node-rsa and the server plugins).
  get createServer () { return require('./createServer') },
  Client,
  get Server () { return require('./server') },
  states: require('./states'),
  createSerializer: serializer.createSerializer,
  createDeserializer: serializer.createDeserializer,
  ping: require('./ping'),
  supportedVersions: require('./version').supportedVersions,
  defaultVersion: require('./version').defaultVersion
}
