/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const minecraftData = require('minecraft-data')
const { supportedVersions } = require('../')

describe('automatic version schema selection', () => {
  const pingPath = require.resolve('../src/ping')
  const autoPath = require.resolve('../src/client/autoVersion')
  let originalPing
  let response
  beforeEach(() => {
    originalPing = require.cache[pingPath]
    require.cache[pingPath] = { exports: (options, callback) => callback(null, response) }
    delete require.cache[autoPath]
  })
  afterEach(() => {
    if (originalPing) require.cache[pingPath] = originalPing
    else delete require.cache[pingPath]
    delete require.cache[autoPath]
  })

  it('selects an actual protocol 5 schema instead of a snapshot alias with protocol 47 data', () => {
    response = { version: { name: '1.7.10', protocol: 5 } }
    const client = new EventEmitter()
    const options = {}
    let allowed = false
    client.once('connect_allowed', () => { allowed = true })
    require('../src/client/autoVersion')(client, options)
    assert.equal(options.version, '1.7.10')
    assert.equal(client.version, '1.7.10')
    assert.equal(allowed, true)
  })

  it('reports unsupported schemas without proceeding to connect', () => {
    response = { version: { name: 'unknown', protocol: -987654 } }
    const client = new EventEmitter()
    let error
    client.once('error', value => { error = value })
    client.once('connect_allowed', () => assert.fail('unsupported version must not connect'))
    require('../src/client/autoVersion')(client, {})
    assert.match(error.message, /Unsupported protocol version/)
  })

  for (const version of supportedVersions) {
    it(`selects matching wire data for supported release ${version}`, () => {
      const protocol = minecraftData(version).version.version
      response = { version: { name: version, protocol } }
      const client = new EventEmitter()
      require('../src/client/autoVersion')(client, {})
      assert.equal(minecraftData(client.version).version.version, protocol)
    })
  }
})
