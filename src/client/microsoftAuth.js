const msal = require('@azure/msal-node')
const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const fetch = require('node-fetch')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const mcDefaultFolderPath = require('minecraft-folder-path')

const authConstants = require('./authConstants')
const { MsaTokenManager, XboxTokenManager, MinecraftTokenManager } = require('./tokens')

const getFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'node-minecraft-protocol'
  }
}

// Initialize msal

// See https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/request.md#public-apis-1
// for docs
const msalConfig = {
  auth: {
    // the minecraft client:
    // clientId: "000000004C12AE6F",
    clientId: '389b1b32-b5d5-43b2-bddc-84ce938d6737', // token from https://github.com/microsoft/Office365APIEditor
    // clientId: '60bad957-e36a-472d-a72a-612ad7f66b46', // @extremeheat
    // clientId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264', // MS Teams
    authority: 'https://login.microsoftonline.com/consumers'

    // test out using live.com:
    // validateAuthority: false,
    // knownAuthorities: ["login.live.com"],
    // protocolMode: 'OIDC',
    // authority: 'https://login.live.com'
  },
  system: {
    loggerOptions: {
      loggerCallback (loglevel, message, containsPii) {
        // console.debug('[msal] ', this.logLevel, message)
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose
    }
  }
}

let msa, xbl, mca

function debug (...message) {
  console.debug(message[0])
}

async function postAuthenticate (client, options, mcAccessToken) {
  options.haveCredentials = mcAccessToken != null

  const MinecraftProfile = await fetch(authConstants.MinecraftServicesProfile, getFetchOptions).then((res) => {
    if (res.ok) { // res.status >= 200 && res.status < 300
      return res.json()
    } else {
      const user = msa.getUsers()[0]
      // debug(user)
      console.error(`Failed to obtain Minecraft profile data for '${user?.username}', does the account own Minecraft Java?`)
      throw Error(res.statusText)
    }
  })
  if (!MinecraftProfile.id) throw Error('This user does not own minecraft according to minecraft services.')

  // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
  // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
  // - Kashalls
  const profile = {
    name: MinecraftProfile.name,
    id: MinecraftProfile.id
  }

  const session = {
    accessToken: mcAccessToken,
    selectedProfile: profile,
    availableProfile: [profile]
  }
  client.session = session
  client.username = MinecraftProfile.name
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
    return await authenticateDeviceToken(client, options)
  }

  const MineServicesResponse = await fetch(authConstants.MinecraftServicesLogWithXbox, {
    method: 'post',
    ...getFetchOptions,
    body: JSON.stringify({ identityToken: `XBL3.0 x=${XAuthResponse.userHash};${XAuthResponse.XSTSToken}` })
  }).then(checkStatus)

  getFetchOptions.headers.Authorization = `Bearer ${MineServicesResponse.access_token}`
  const MineEntitlements = await fetch(authConstants.MinecraftServicesEntitlement, getFetchOptions).then(checkStatus)
  if (MineEntitlements.items.length === 0) throw Error('This user does not have any items on its accounts according to minecraft services.')

  postAuthenticate(client, options, MineServicesResponse.access_token)
}

async function getMsaToken () {
  if (await msa.verifyTokens()) {
    return msa.getAccessToken().token
  } else {
    const ret = await msa.authDeviceToken((response) => {
      console.info('[msa] First time signing in. Please authenticate now:')
      console.info(response.message)
      // console.log('Data', data)
    })

    console.info(`[msa] Signed in as ${ret.account.username}`)

    debug('[msa] got auth result', ret)
    return ret.accessToken
  }
}

async function getXboxToken () {
  if (await xbl.verifyTokens()) {
    return xbl.getCachedXstsToken().data
  } else {
    const msaToken = await getMsaToken()
    const ut = await xbl.getUserToken(msaToken)
    const xsts = await xbl.getXSTSToken(ut)
    return xsts
  }
}

async function getMinecraftToken () {
  if (await mca.verifyTokens()) {
    return mca.getCachedAccessToken().token
  } else {
    const xsts = await getXboxToken()
    debug('xsts data', xsts)
    return mca.getAccessToken(xsts)
  }
}

function sha1 (data) {
  return crypto.createHash('sha1').update(data || '', 'binary').digest('hex')
}

async function initTokenCaches (username, cacheDir) {
  const hash = sha1(username).substr(0, 6)

  let cachePath = cacheDir || mcDefaultFolderPath
  try {
    await fs.promises.access(cachePath)
    fs.mkdirSync(cachePath + '/nmp-cache')
    cachePath += '/nmp-cache'
  } catch (e) {
    console.log('Failed to open cache dir', e)
    cachePath = __dirname
  }

  const cachePaths = {
    msa: path.join(cachePath, `./${hash}_msa-cache.json`),
    xbl: path.join(cachePath, `./${hash}_xbl-cache.json`),
    mca: path.join(cachePath, `./${hash}_mca-cache.json`)
  }

  const scopes = ['XboxLive.signin', 'offline_access']
  msa = new MsaTokenManager(msalConfig, scopes, cachePaths.msa)
  xbl = new XboxTokenManager(authConstants.XSTSRelyingParty, cachePaths.xbl)
  mca = new MinecraftTokenManager(cachePaths.mca)
}

async function authenticateDeviceToken (client, options) {
  await initTokenCaches(options.username, options.cacheDir)

  const token = await getMinecraftToken()
  console.debug('Acquired Minecraft token', token)

  getFetchOptions.headers.Authorization = `Bearer ${token}`
  postAuthenticate(client, options, token)
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
  authenticateDeviceToken
}

async function msaTest () {
  await authenticateDeviceToken({}, {})
}

// debug with node microsoftAuth.js
if (!module.parent) {
  msaTest()
}
