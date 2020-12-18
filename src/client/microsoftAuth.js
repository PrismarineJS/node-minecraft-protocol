const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const fetch = require('node-fetch')

const XSTSRelyingParty = 'rp://api.minecraftservices.com/'
const MinecraftServicesLogWithXbox = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MinecraftServicesEntitlement = 'https://api.minecraftservices.com/entitlements/mcstore'
const MinecraftServicesProfile = 'https://api.minecraftservices.com/minecraft/profile'

const getFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'node-minecraft-protocol'
  }
}

/**
 * Authenticates with Xbox Live, then Authenticates with Minecraft, Checks Entitlements and Gets Profile.
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */

module.exports = async (client, options) => {
  // Use external library to authenticate with
  const XAuthResponse = await XboxLiveAuth.authenticate(options.username, options.password, { XSTSRelyingParty })
    .catch((err) => {
      if (err.details) throw new Error(`Unable to authenticate with Xbox Live: ${JSON.stringify(err.details)}`)
      else throw Error(err)
    })

  const MineServicesResponse = await fetch(MinecraftServicesLogWithXbox, {
    method: 'post',
    ...getFetchOptions,
    body: JSON.stringify({ identityToken: `XBL3.0 x=${XAuthResponse.userHash};${XAuthResponse.XSTSToken}` })
  }).then(checkStatus)

  options.haveCredentials = MineServicesResponse.access_token != null

  getFetchOptions.headers.Authorization = `Bearer ${MineServicesResponse.access_token}`
  const MineEntitlements = await fetch(MinecraftServicesEntitlement, getFetchOptions).then(checkStatus)
  if (MineEntitlements.items.length === 0) throw Error('This user does not have any items on its accounts according to minecraft services.')

  const MinecraftProfile = await fetch(MinecraftServicesProfile, getFetchOptions).then(checkStatus)
  if (!MinecraftProfile.id) throw Error('This user does not own minecraft according to minecraft services.')

  // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
  // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
  // - Kashalls
  const profile = {
    name: MinecraftProfile.name,
    id: MinecraftProfile.id
  }

  const session = {
    accessToken: MineServicesResponse.access_token,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = MinecraftProfile.name
  options.accessToken = MineServicesResponse.access_token
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
