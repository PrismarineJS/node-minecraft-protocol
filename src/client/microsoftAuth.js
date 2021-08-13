const path = require('path')
const { Authflow: PrismarineAuth } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')

async function authenticate (client, options) {
  if (!options.profilesFolder) {
    options.profilesFolder = path.join(minecraftFolderPath, 'nmp-cache')
  }

  const Authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
  const { token, entitlements, profile } = await Authflow.getMinecraftJavaToken({ fetchEntitlements: true, fetchProfile: true })

  if (entitlements.items.length === 0) throw Error('This user does not possess any entitlements on this account according to minecraft services.')
  debug('[mc] entitlements', entitlements)

  options.haveCredentials = token !== null
  if (profile.error) throw Error(`Failed to obtain profile data for ${options.username}, does the account own minecraft?\n${profile}`)
  debug('[mc] profile', profile)

  const session = {
    accessToken: token,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = profile.name
  options.accessToken = token
  client.emit('session', session)
  options.connect(client)
}

module.exports = {
  authenticate
}
