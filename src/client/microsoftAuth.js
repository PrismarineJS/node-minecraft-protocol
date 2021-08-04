const { Authflow: PrismarineAuth } = require('prismarine-auth')
const fetch = require('node-fetch')
const authConstants = require('./authConstants')

const debug = require('debug')('minecraft-protocol')

const getFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'node-minecraft-protocol'
  }
}

async function authenticate (client, options) {
  if (!options.profilesFolder && options.profilesFolder !== false) {
    options.profilesFolder = require('minecraft-folder-path')
  }

  const Authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
  const accessToken = await Authflow.getMinecraftJavaToken()

  // We have a minecraft access token.
  // Let's verify entitlements.

  getFetchOptions.headers.Authorization = `Bearer ${accessToken}`
  const MineEntitlements = await fetch(authConstants.MinecraftServicesEntitlement, getFetchOptions).then(checkStatus)
  if (MineEntitlements.items.length === 0) throw Error('This user does not possess any entitlements on this account according to minecraft services.')

  // We know that this account owns minecraft.
  // Let's fetch the profile data.

  options.haveCredentials = accessToken != null

  const MinecraftProfile = await fetch(authConstants.MinecraftServicesProfile, getFetchOptions)
    .then(async (res) => {
      if (res.ok) return await res.json()
      else throw new Error(`HTTP Error Response: ${res.status} ${res.statusText}`)
    })
    .catch((res) => {
      const user = Authflow.username ?? options.username
      throw Error(`Failed to obtain profile date for "${user?.username}", does the account own minecraft?\nServer returned: ${res.statusText}`)
    })

  if (!MinecraftProfile.id) {
    debug('[mc] profile', MinecraftProfile)
    throw Error('This user does not own minecraft according to minecraft services.')
  }

  // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
  // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
  // - Kashalls
  const profile = {
    name: MinecraftProfile.name,
    id: MinecraftProfile.id
  }

  const session = {
    accessToken,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = MinecraftProfile.name
  options.accessToken = accessToken
  client.emit('session', session)
  options.connect(client)
}

function checkStatus (res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res.json()
  } else {
    throw Error(res.statusText)
  }
}

module.exports = {
  authenticate
}
