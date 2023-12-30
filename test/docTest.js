/* eslint-env mocha */

const mc = require('../')
const fs = require('fs')
const assert = require('assert')
const path = require('path')

const readmeContent = fs.readFileSync(path.join(__dirname, '/../docs/README.md'), { encoding: 'utf8', flag: 'r' })

for (const supportedVersion of mc.supportedVersions) {
  describe('doc ' + supportedVersion + 'v', function () {
    it('mentions the supported version in the readme', () => {
      assert.ok(readmeContent.includes(supportedVersion), `${supportedVersion} should be mentionned in the README.md but it is not`)
    })
  })
}
