/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const minecraftData = require('minecraft-data')
const { supportedVersions } = require('../')

// CI runs `mocha -g ${matrix.mcVersion}v`, so a suite only runs in a matrix job when its title contains that version + 'v'
// (the same convention packetTest/cyclePacketTest use). The version-independent cases below are wired to one matrix version
// so they execute in CI; the per-version loop labels each case with its own version so every matrix job runs its own.
const CI_PIN = supportedVersions.includes('1.20.1') ? '1.20.1' : supportedVersions[supportedVersions.length - 1]

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

  describe(`core resolution (${CI_PIN}v)`, () => {
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

    it('prefers the name-matching release over a newer patch on a shared protocol', () => {
      // 1.21 and 1.21.1 share protocol 767; the server reported 1.21, so 1.21 must win (not the first-listed 1.21.1).
      response = { version: { name: '1.21', protocol: 767 } }
      const client = new EventEmitter()
      const options = {}
      require('../src/client/autoVersion')(client, options)
      assert.equal(options.version, '1.21')
    })

    it('ignores an invalid protocol and resolves from the name', () => {
      response = { version: { name: 'Paper 1.20.4', protocol: -1 } }
      const client = new EventEmitter()
      const options = {}
      require('../src/client/autoVersion')(client, options)
      assert.equal(options.version, '1.20.4')
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
  })

  for (const version of supportedVersions) {
    it(`selects matching wire data for supported release ${version}v`, () => {
      const protocol = minecraftData(version).version.version
      response = { version: { name: version, protocol } }
      const client = new EventEmitter()
      require('../src/client/autoVersion')(client, {})
      assert.equal(minecraftData(client.version).version.version, protocol)
    })
  }
})
