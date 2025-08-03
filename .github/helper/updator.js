#!/usr/bin/env node
/**
 * Updator script triggered from minecraft-data repository
 * This script can be customized to handle updates from minecraft-data
 */
const github = require('gh-helpers')()
const fs = require('fs')
const cp = require('child_process')
const { join } = require('path')
const exec = (cmd) => github.mock ? console.log('> ', cmd) : (console.log('> ', cmd), cp.execSync(cmd, { stdio: 'inherit' }))

console.log('Starting update process...')
const triggerBranch = process.env.TRIGGER_SOURCE
const newVersion = process.env.DATA_VERSION
const onBehalfOf = process.env.TRIGGER_REASON || 'workflow_dispatch'
console.log('Trigger reason:', onBehalfOf)
console.log('New version:', newVersion)

if (!newVersion) {
  console.error('No new version provided. Exiting...')
  process.exit(1)
}

async function main () {
  const currentSupportedPath = require.resolve('../../src/version.js')
  const readmePath = join(__dirname, '../../docs/README.md')
  const ciPath = join(__dirname, '../../.github/workflows/ci.yml')

  // Update the version.js
  const currentSupportedVersion = require('../../src/version.js')
  const currentContents = fs.readFileSync(currentSupportedPath, 'utf8')
  console.log('Current supported version:', currentContents)
  const newContents = currentContents.includes(newVersion)
    ? currentContents
    : currentContents
      .replace(`: '${currentSupportedVersion.defaultVersion}'`, `: '${newVersion}'`)
      .replace(`, '${currentSupportedVersion.defaultVersion}'`, `, '${currentSupportedVersion.defaultVersion}', '${newVersion}'`)

  // Update the README.md
  const currentContentsReadme = fs.readFileSync(readmePath, 'utf8')
  if (!currentContentsReadme.includes(newVersion)) {
    const newReadmeContents = currentContentsReadme.replace(' <!-- NEXT_VERSION -->', `, ${newVersion} <!-- NEXT_VERSION -->`)
    fs.writeFileSync(readmePath, newReadmeContents)
    console.log('Updated README with new version:', newVersion)
  }
  fs.writeFileSync(currentSupportedPath, newContents)

  // Update the CI workflow
  const currentContentsCI = fs.readFileSync(ciPath, 'utf8')
  if (!currentContentsCI.includes(newVersion)) {
    const newCIContents = currentContentsCI.replace(
      '      run: npm install', `
      run: npm install
    - run: cd node_modules && cd minecraft-data && mv minecraft-data minecraft-data-old && git clone -b ${triggerBranch} https://github.com/PrismarineJS/minecraft-data --depth 1 && node bin/generate_data.js
    - run: curl -o node_modules/protodef/src/serializer.js https://raw.githubusercontent.com/extremeheat/node-protodef/refs/heads/dlog/src/serializer.js && curl -o node_modules/protodef/src/compiler.js https://raw.githubusercontent.com/extremeheat/node-protodef/refs/heads/dlog/src/compiler.js
`)
    fs.writeFileSync(ciPath, newCIContents)
    console.log('Updated CI workflow with new version:', newVersion)
  }

  const branchName = 'pc' + newVersion.replace(/[^a-zA-Z0-9_]/g, '.')
  exec(`git checkout -b ${branchName}`)
  exec('git add --all')
  exec(`git commit -m "Update to version ${newVersion}"`)
  exec(`git push origin ${branchName}`)
  //     createPullRequest(title: string, body: string, fromBranch: string, intoBranch?: string): Promise<{ number: number, url: string }>;
  const pr = await github.createPullRequest(
    `${newVersion} updates`,
    `Automatically generated PR for Minecraft version ${newVersion}.\n\nRef: ${onBehalfOf}`,
    branchName,
    'master'
  )
  console.log(`Pull request created: ${pr.url} (PR #${pr.number})`)
  console.log('Update process completed successfully!')
}

main().catch(err => {
  console.error('Error during update process:', err)
  process.exit(1)
})
