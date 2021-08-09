const { Authflow: PrismarineAuth, Endpoints } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')

async function authenticate (client, options) {
  if (!options.profilesFolder) {
    options.profilesFolder = minecraftFolderPath
  }

  options = Object.assign(options, { fetchEntitlements: true, fetchProfile: true })
  const Authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
  const { token, entitlements, profile } = await Authflow.getMinecraftJavaToken()

  if (entitlements.items.length === 0) throw Error('This user does not possess any entitlements on this account according to minecraft services.')
  debug('[mc] entitlements', entitlements)

  options.haveCredentials = token != null
  const user = Authflow.username ?? options.username
  if (profile.error) throw Error(`Failed to obtain profile data for ${user?.username}, does the account own minecraft?\n${profile}`)
  debug(`[mc] profile`, profile)

  const session = {
    accessToken,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = mcProfile.name
  options.accessToken = accessToken
  client.emit('session', session)
  options.connect(client)
}

module.exports = {
  authenticate
}
