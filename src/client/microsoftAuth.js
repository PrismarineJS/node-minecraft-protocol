const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const authConstants = require('./authConstants')
const { MsAuthFlow } = require('./authFlow.js')

const fetch = require('node-fetch')

const debug = require('debug')('minecraft-protocol')

const getFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'node-minecraft-protocol'
  }
}

const { Authflow: PrismarineAuth } = require('prismarine-auth')
async function authenticate (client, options) {
  if (!options.profilesFolder && options.profilesFolder !== false) {
    options.profilesFolder = require('minecraft-folder-path')
  }

  const Authflow = new PrismarineAuth(options.username, options.profilesFolder , options, options.onMsaCode)
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

/**
 * Obtains Minecaft profile data using a Minecraft access token and starts the join sequence
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 * @param {string} mcAccessToken - Minecraft access token for session server
 * @param {object?} msa - Cached Microsoft account data for more descriptive errors
 */
async function postAuthenticate (client, options, mcAccessToken, msa) {
  options.haveCredentials = mcAccessToken != null

  let minecraftProfile
  const res = await fetch(authConstants.MinecraftServicesProfile, getFetchOptions)
  if (res.ok) { // res.status >= 200 && res.status < 300
    minecraftProfile = await res.json()
  } else {
    const user = msa ? msa.getUsers()[0] : options.username
    throw Error(`Failed to obtain Minecraft profile data for '${user?.username}', does the account own Minecraft Java? Server returned: ${res.statusText}`)
  }

  if (!minecraftProfile.id) {
    debug('[mc] profile', minecraftProfile)
    throw Error('This user does not own minecraft according to minecraft services.')
  }

  // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
  // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
  // - Kashalls
  const profile = {
    name: minecraftProfile.name,
    id: minecraftProfile.id
  }

  const session = {
    accessToken: mcAccessToken,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = minecraftProfile.name
  options.accessToken = mcAccessToken
  client.emit('session', session)
  options.connect(client)
}

/**
 * Authenticates with Mincrosoft through user credentials, then
 * with Xbox Live, Minecraft, checks entitlements and returns profile
 *
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */
async function authenticatePassword (client, options) {
  let XAuthResponse

  try {
    XAuthResponse = await XboxLiveAuth.authenticate(options.username, options.password, { XSTSRelyingParty: authConstants.XSTSRelyingParty })
      .catch((err) => {
        console.warn('Unable to authenticate with Microsoft', err)
        throw err
      })
  } catch (e) {
    console.info('Retrying auth with device code flow')
    return await authenticateDeviceCode(client, options)
  }

  try {
    const MineServicesResponse = await fetch(authConstants.MinecraftServicesLogWithXbox, {
      method: 'post',
      ...getFetchOptions,
      body: JSON.stringify({ identityToken: `XBL3.0 x=${XAuthResponse.userHash};${XAuthResponse.XSTSToken}` })
    }).then(checkStatus)

    getFetchOptions.headers.Authorization = `Bearer ${MineServicesResponse.access_token}`
    const MineEntitlements = await fetch(authConstants.MinecraftServicesEntitlement, getFetchOptions).then(checkStatus)
    if (MineEntitlements.items.length === 0) throw Error('This user does not have any items on its accounts according to minecraft services.')

    await postAuthenticate(client, options, MineServicesResponse.access_token)
  } catch (err) {
    console.error(err)
    client.emit('error', err)
  }
}

/**
 * Authenticates to Minecraft via device code based Microsoft auth,
 * then connects to the specified server in Client Options
 *
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */
async function authenticateDeviceCode (client, options) {
  try {
    const flow = new MsAuthFlow(options.username, options.profilesFolder, options.onMsaCode)

    const token = await flow.getMinecraftToken()
    debug('Acquired Minecraft token', token.slice(0, 16))

    getFetchOptions.headers.Authorization = `Bearer ${token}`
    await postAuthenticate(client, options, token, flow.msa)
  } catch (err) {
    console.error(err)
    client.emit('error', err)
  }
}

function checkStatus (res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res.json()
  } else {
    throw Error(res.statusText)
  }
}

module.exports = {
  authenticatePassword,
  authenticate,
  authenticateDeviceCode
}
