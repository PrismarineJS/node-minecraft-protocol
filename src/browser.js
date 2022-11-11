'use strict'

const Client = require('./client')
const Server = require('./server')
const serializer = require('./transforms/serializer')

module.exports = {
  Client,
  Server,
  states: require('./states'),
  createSerializer: serializer.createSerializer,
  createDeserializer: serializer.createDeserializer,
  supportedVersions: require('./version').supportedVersions
}
