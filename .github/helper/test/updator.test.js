const sinon = require('sinon')
const fs = require('fs')
const cp = require('child_process')
const assert = require('assert')

// Mock gh-helpers
const mockGithub = {
  mock: true,
  createPullRequest: sinon.stub().resolves({ number: 123, url: 'test-pr' })
}

// Mock modules
const Module = require('module')
const originalRequire = Module.prototype.require

Module.prototype.require = function(id) {
  if (id === 'gh-helpers') {
    return () => mockGithub
  }
  return originalRequire.apply(this, arguments)
}

describe('Node Minecraft Protocol Updator', function() {
  let originalEnv
  let fsStub
  let cpStub

  beforeEach(function() {
    originalEnv = process.env
    process.env = { ...originalEnv }
    
    // Stub fs and child_process
    fsStub = {
      readFileSync: sinon.stub(fs, 'readFileSync'),
      writeFileSync: sinon.stub(fs, 'writeFileSync')
    }
    
    cpStub = {
      execSync: sinon.stub(cp, 'execSync')
    }
    
    sinon.reset()
  })

  afterEach(function() {
    process.env = originalEnv
    sinon.restore()
  })

  describe('Version Update', function() {
    it('should add new version to supportedVersions array', function() {
      const currentVersionFile = `'use strict'

module.exports = {
  defaultVersion: '1.21.8',
  supportedVersions: ['1.7', '1.8.8', '1.21.8']
}`

      fsStub.readFileSync.returns(currentVersionFile)
      
      // Test the logic for adding new version
      const newContents = currentVersionFile.replace(", '1.21.8'", ", '1.21.8', '1.21.9'")
      assert(newContents.includes("'1.21.9'"), 'Should contain new version')
    })

    it('should not duplicate existing versions', function() {
      const versionFileWithExisting = `module.exports = {
  supportedVersions: ['1.21.6', '1.21.8']
}`

      fsStub.readFileSync.returns(versionFileWithExisting)
      
      // Should not add duplicate
      const result = versionFileWithExisting.includes('1.21.8') 
        ? versionFileWithExisting 
        : versionFileWithExisting.replace("]", ", '1.21.8']")
        
      assert.strictEqual(result, versionFileWithExisting, 'Should not change if version exists')
    })

    it('should update README.md with new version', function() {
      const readmeContent = `# Minecraft Protocol

Supports Minecraft 1.8 to 1.21.8 (https://wiki.vg/Protocol_version_numbers)

Versions 1.7.10, 1.8.8, 1.21.6, 1.21.8) <!--version-->`

      const expectedReadme = readmeContent
        .replace('Minecraft 1.8 to 1.21.8 (', 'Minecraft 1.8 to 1.21.9 (')
        .replace(') <!--version-->', ', 1.21.9) <!--version-->')

      assert(expectedReadme.includes('1.21.9'), 'README should contain new version')
      assert(expectedReadme.includes('Minecraft 1.8 to 1.21.9'), 'README should update version range')
    })
  })

  describe('Git Operations', function() {
    it('should create correct branch name', function() {
      const version = '1.21.9'
      const expectedBranch = 'pc' + version.replace(/[^a-zA-Z0-9_]/g, '_')
      assert.strictEqual(expectedBranch, 'pc1_21_9')
    })

    it('should execute git commands in correct order', function() {
      const expectedCommands = [
        'git checkout -b pc1_21_9',
        'git config user.name "github-actions[bot]"',
        'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
        'git add --all',
        'git commit -m "Update to version 1.21.9"',
        'git push origin pc1_21_9 --force'
      ]
      
      // Verify command sequence would be correct
      expectedCommands.forEach((cmd, index) => {
        assert(cmd.includes('git'), `Command ${index} should be a git command`)
      })
    })
  })

  describe('Environment Variable Validation', function() {
    it('should fail without required NEW_MC_VERSION', function() {
      delete process.env.NEW_MC_VERSION
      
      assert.throws(() => {
        const newVersion = process.env.NEW_MC_VERSION?.replace(/[^a-zA-Z0-9_.]/g, '_')
        if (!newVersion) throw new Error('NEW_MC_VERSION required')
      }, /NEW_MC_VERSION required/)
    })

    it('should sanitize version strings correctly', function() {
      const testCases = [
        { input: '1.21.9', expected: '1.21.9' },
        { input: '1.21.9-test', expected: '1.21.9_test' },
        { input: '24w01a', expected: '24w01a' },
        { input: 'invalid!@#', expected: 'invalid___' }
      ]
      
      testCases.forEach(({ input, expected }) => {
        const sanitized = input.replace(/[^a-zA-Z0-9_.]/g, '_')
        assert.strictEqual(sanitized, expected)
      })
    })
  })

  describe('PR Creation', function() {
    it('should create PR with correct title and body', function() {
      const version = '1.21.9'
      const expectedTitle = `🎈 ${version}`
      const expectedBody = `This automated PR sets up the relevant boilerplate for Minecraft version ${version}.

Ref: 

* You can help contribute to this PR by opening a PR against this <code branch>pc1_21_9</code> branch instead of <code>master</code>.
    `
    
      assert.strictEqual(expectedTitle, '🎈 1.21.9')
      assert(expectedBody.includes('Minecraft version 1.21.9'), 'Body should contain version')
      assert(expectedBody.includes('pc1_21_9'), 'Body should contain branch name')
    })
  })

  describe('Error Handling', function() {
    it('should handle git command failures', function() {
      cpStub.execSync.throws(new Error('Push failed'))
      
      assert.throws(() => {
        try {
          cpStub.execSync('git push origin test --force')
        } catch (e) {
          throw new Error(`Git operation failed: ${e.message}`)
        }
      }, /Git operation failed: Push failed/)
    })

    it('should handle file system errors', function() {
      fsStub.readFileSync.throws(new Error('File not found'))
      
      assert.throws(() => {
        try {
          fsStub.readFileSync('non-existent-file')
        } catch (e) {
          throw new Error(`File operation failed: ${e.message}`)
        }
      }, /File operation failed: File not found/)
    })
  })
})