const cp = require('child_process')

function spawnGit (args, { mock = false } = {}) {
  console.log('> git', args.join(' '))
  if (mock) return
  const result = cp.spawnSync('git', args, { stdio: 'inherit', shell: false })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

module.exports = spawnGit
