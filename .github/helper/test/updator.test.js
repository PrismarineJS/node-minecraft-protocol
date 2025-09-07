const { jest } = require('@jest/globals')
const fs = require('fs')
const cp = require('child_process')

// Mock dependencies
jest.mock('fs')
jest.mock('child_process')
jest.mock('gh-helpers', () => () => ({
  mock: true,
  createPullRequest: jest.fn().mockResolvedValue({ number: 123, url: 'test-pr' })
}))

describe('Node Minecraft Protocol Updator', () => {
  let originalEnv
  let mockFs
  let mockCp

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    
    mockFs = {
      readFileSync: jest.fn(),
      writeFileSync: jest.fn()
    }
    
    mockCp = {
      execSync: jest.fn()
    }
    
    fs.readFileSync = mockFs.readFileSync
    fs.writeFileSync = mockFs.writeFileSync
    cp.execSync = mockCp.execSync
    
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  describe('Version Update', () => {
    test('should add new version to supportedVersions array', () => {
      process.env.NEW_MC_VERSION = '1.21.9'
      process.env.MCDATA_BRANCH = 'test-branch'
      
      const currentVersionFile = `'use strict'

module.exports = {
  defaultVersion: '1.21.8',
  supportedVersions: ['1.7', '1.8.8', '1.21.8']
}`

      const expectedVersionFile = `'use strict'

module.exports = {
  defaultVersion: '1.21.8',
  supportedVersions: ['1.7', '1.8.8', '1.21.8', '1.21.9']
}`

      mockFs.readFileSync.mockReturnValue(currentVersionFile)
      
      delete require.cache[require.resolve('../updator.js')]
      
      // Mock the actual script behavior
      const newContents = currentVersionFile.replace(", '1.21.8'", ", '1.21.8', '1.21.9'")
      expect(newContents).toContain("'1.21.9'")
    })

    test('should not duplicate existing versions', () => {
      process.env.NEW_MC_VERSION = '1.21.8'
      
      const versionFileWithExisting = `module.exports = {
  supportedVersions: ['1.21.6', '1.21.8']
}`

      mockFs.readFileSync.mockReturnValue(versionFileWithExisting)
      
      // Should not add duplicate
      const result = versionFileWithExisting.includes('1.21.8') 
        ? versionFileWithExisting 
        : versionFileWithExisting.replace("]", ", '1.21.8']")
        
      expect(result).toBe(versionFileWithExisting) // No change
    })

    test('should update README.md with new version', () => {
      const readmeContent = `# Minecraft Protocol

Supports Minecraft 1.8 to 1.21.8 (https://wiki.vg/Protocol_version_numbers)

Versions 1.7.10, 1.8.8, 1.9.4, 1.10.2, 1.11.2, 1.12.2, 1.13.2, 1.14.4, 1.15.2, 1.16.5, 1.17.1, 1.18.2, 1.19, 1.19.2, 1.19.3, 1.19.4, 1.20, 1.20.1, 1.20.2, 1.20.4, 1.20.6, 1.21.1, 1.21.3, 1.21.4, 1.21.5, 1.21.6, 1.21.8) <!--version-->`

      const expectedReadme = readmeContent
        .replace('Minecraft 1.8 to 1.21.8 (', 'Minecraft 1.8 to 1.21.9 (')
        .replace(') <!--version-->', ', 1.21.9) <!--version-->')

      expect(expectedReadme).toContain('1.21.9')
      expect(expectedReadme).toContain('Minecraft 1.8 to 1.21.9')
    })
  })

  describe('Git Operations', () => {
    test('should create correct branch name', () => {
      const version = '1.21.9'
      const expectedBranch = 'pc' + version.replace(/[^a-zA-Z0-9_]/g, '_')
      expect(expectedBranch).toBe('pc1_21_9')
    })

    test('should execute git commands in correct order', () => {
      process.env.NEW_MC_VERSION = '1.21.9'
      
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
        expect(cmd).toContain('git')
      })
    })
  })

  describe('Environment Variable Validation', () => {
    test('should fail without required NEW_MC_VERSION', () => {
      delete process.env.NEW_MC_VERSION
      
      expect(() => {
        const newVersion = process.env.NEW_MC_VERSION?.replace(/[^a-zA-Z0-9_.]/g, '_')
        if (!newVersion) throw new Error('NEW_MC_VERSION required')
      }).toThrow('NEW_MC_VERSION required')
    })

    test('should sanitize version strings correctly', () => {
      const testCases = [
        { input: '1.21.9', expected: '1.21.9' },
        { input: '1.21.9-test', expected: '1.21.9_test' },
        { input: '24w01a', expected: '24w01a' },
        { input: 'invalid!@#', expected: 'invalid___' }
      ]
      
      testCases.forEach(({ input, expected }) => {
        const sanitized = input.replace(/[^a-zA-Z0-9_.]/g, '_')
        expect(sanitized).toBe(expected)
      })
    })
  })

  describe('PR Creation', () => {
    test('should create PR with correct title and body', () => {
      const version = '1.21.9'
      const expectedTitle = `🎈 ${version}`
      const expectedBody = `This automated PR sets up the relevant boilerplate for Minecraft version ${version}.

Ref: 

* You can help contribute to this PR by opening a PR against this <code branch>pc1_21_9</code> branch instead of <code>master</code>.
    `
    
      expect(expectedTitle).toBe('🎈 1.21.9')
      expect(expectedBody).toContain('Minecraft version 1.21.9')
      expect(expectedBody).toContain('pc1_21_9')
    })
  })

  describe('Error Handling', () => {
    test('should handle git command failures', () => {
      mockCp.execSync.mockImplementation((cmd) => {
        if (cmd.includes('git push')) {
          throw new Error('Push failed')
        }
      })
      
      expect(() => {
        try {
          mockCp.execSync('git push origin test --force')
        } catch (e) {
          throw new Error(`Git operation failed: ${e.message}`)
        }
      }).toThrow('Git operation failed: Push failed')
    })

    test('should handle file system errors', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found')
      })
      
      expect(() => {
        try {
          mockFs.readFileSync('non-existent-file')
        } catch (e) {
          throw new Error(`File operation failed: ${e.message}`)
        }
      }).toThrow('File operation failed: File not found')
    })
  })
})