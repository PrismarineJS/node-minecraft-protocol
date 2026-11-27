/* eslint-env mocha */

const assert = require('assert')
const { EventEmitter } = require('events')
const { authenticate } = require('../src/client/microsoftAuth')
const { supportedVersions } = require('../src/version')

for (const version of supportedVersions) {
  describe(`microsoft authentication ${version}v`, () => {
    it('exposes the selected profile under availableProfiles', async () => {
      const profile = { id: '00000000000000000000000000000001', name: 'Player' }
      const client = new EventEmitter()
      client.authflow = {
        getMinecraftJavaToken: async () => ({
          token: 'access-token',
          entitlements: {},
          profile,
          certificates: {}
        })
      }

      let emittedSession
      let connectedClient
      client.on('session', session => { emittedSession = session })
      const options = {
        username: profile.name,
        profilesFolder: 'unused',
        connect: connected => { connectedClient = connected }
      }

      await authenticate(client, options)

      assert.deepStrictEqual(client.session.availableProfiles, [profile])
      assert.deepStrictEqual(client.session.availableProfile, [profile])
      assert.strictEqual(emittedSession, client.session)
      assert.strictEqual(connectedClient, client)
    })
  })
}
