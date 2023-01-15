const path = require('path')
const { Authflow: PrismarineAuth, Titles } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')
const { RealmAPI } = require('prismarine-realms')

function validateOptions (options) {
  if (!options.profilesFolder) {
    options.profilesFolder = path.join(minecraftFolderPath, 'nmp-cache')
  }
  if (options.authTitle === undefined) {
    options.authTitle = Titles.MinecraftNintendoSwitch
    options.deviceType = 'Nintendo'
    options.flow = 'live'
  }
}

async function authenticate (client, options) {
  validateOptions(options)

  if (!client.authflow) client.authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
  const { token, entitlements, profile, certificates } = await client.authflow.getMinecraftJavaToken({ fetchProfile: true, fetchCertificates: !options.disableChatSigning }).catch(e => {
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
  Object.assign(client, certificates)
  client.session = session
  client.username = profile.name

  options.accessToken = token
  client.emit('session', session)
  options.connect(client)
}

async function realmAuthenticate (client, options) {
  validateOptions(options)

  client.authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)

  const api = RealmAPI.from(client.authflow, 'java')
  const realms = await api.getRealms()

  debug('realms', realms)

  if (!realms || !realms.length) throw Error('Couldn\'t find any Realms for the authenticated account')

  let realm

  if (options.realms.realmId) {
    realm = realms.find(e => e.id === Number(options.realms.realmId))
  } else if (options.realms.pickRealm) {
    if (typeof options.realms.pickRealm !== 'function') throw Error('realms.pickRealm must be a function')
    realm = await options.realms.pickRealm(realms)
  }

  if (!realm) throw Error('Couldn\'t find a Realm to connect to. Authenticated account must be the owner or has been invited to the Realm.')

  const { host, port } = await realm.getAddress()

  debug('realms connection', { host, port })

  options.host = host
  options.port = port
}

module.exports = {
  authenticate,
  realmAuthenticate
}
