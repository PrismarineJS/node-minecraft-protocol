/* eslint-env mocha */

const fs = require('fs')
const assert = require('assert')
const path = require('path')
const testedVersions = require('./common/testedVersions')

const readmeContent = fs.readFileSync(path.join(__dirname, '/../docs/README.md'), { encoding: 'utf8', flag: 'r' })

for (const supportedVersion of testedVersions) {
  describe('doc ' + supportedVersion + 'v', function () {
    it('mentions the supported version in the readme', () => {
      assert.ok(readmeContent.includes(supportedVersion), `${supportedVersion} should be mentionned in the README.md but it is not`)
    })
  })
}
