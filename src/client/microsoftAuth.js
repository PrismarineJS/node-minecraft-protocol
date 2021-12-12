const path = require('path')
const { Authflow: PrismarineAuth, Titles } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')

async function authenticate (client, options) {
  if (!options.profilesFolder) {
    options.profilesFolder = path.join(minecraftFolderPath, 'nmp-cache')
  }

  if (options.authTitle === undefined) {
    options.authTitle = Titles.MinecraftNintendoSwitch
    options.deviceType = 'Nintendo'
  }

  const Authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
  const { token, entitlements, profile } = await Authflow.getMinecraftJavaToken({ fetchProfile: true }).catch(e => {
    if (options.password) console.warn('Sign in failed, try removing the password field\n')
    if (e.toString().includes('Not Found')) console.warn(`Please verify that the account ${options.username} owns Minecraft\n`)
    throw e
  })

  debug('[mc] entitlements', entitlements)
  debug('[mc] profile', profile)

  if (!profile || profile.error) throw Error(`Failed to obtain profile data for ${options.username}, does the account own minecraft?`)

  options.haveCredentials = token !== null

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
