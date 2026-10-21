/* eslint-env mocha */
const assert = require('assert')
const cp = require('child_process')
const spawnGit = require('../.github/helper/spawnGit')

describe('spawnGit', () => {
  const original = cp.spawnSync
  afterEach(() => { cp.spawnSync = original })

  it('throws when git exits with a non-zero status', () => {
    cp.spawnSync = () => ({ status: 1, error: undefined })
    assert.throws(() => spawnGit(['push', 'origin', 'branch']), /exit code 1/)
  })

  it('throws when spawning git itself fails', () => {
    const spawnError = new Error('spawn git ENOENT')
    cp.spawnSync = () => ({ status: null, error: spawnError })
    assert.throws(() => spawnGit(['commit', '-m', 'x']), /ENOENT/)
  })

  it('does not throw when git exits 0', () => {
    cp.spawnSync = () => ({ status: 0, error: undefined })
    assert.doesNotThrow(() => spawnGit(['add', '--all']))
  })

  it('skips spawning entirely in mock mode', () => {
    let called = false
    cp.spawnSync = () => { called = true; return { status: 0 } }
    spawnGit(['push'], { mock: true })
    assert.strictEqual(called, false)
  })
})
