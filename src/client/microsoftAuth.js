const msal = require('@azure/msal-node')
const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
// const debug = require('debug')('minecraft-protocol')
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

function debug (...message) {
  console.debug(message[0])
}

async function retry (methodFn, beforeRety, times) {
  while (times--) {
    if (times !== 0) {
      try { return await methodFn() } catch (e) { debug(e) }
      await beforeRety()
    } else {
      return await methodFn()
    }
  }
}

// TODO: Move this to a new file
class MsAuthFlow {
  constructor (username, cacheDir, codeCallback) {
    this.initTokenCaches(username, cacheDir)
    this.codeCallback = codeCallback
  }

  initTokenCaches (username, cacheDir) {
    const hash = sha1(username).substr(0, 6)

    let cachePath = cacheDir || mcDefaultFolderPath
    try {
      if (!fs.existsSync(cachePath + '/nmp-cache')) {
        fs.mkdirSync(cachePath + '/nmp-cache')
      }
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
    this.msa = new MsaTokenManager(msalConfig, scopes, cachePaths.msa)
    this.xbl = new XboxTokenManager(authConstants.XSTSRelyingParty, cachePaths.xbl)
    this.mca = new MinecraftTokenManager(cachePaths.mca)
  }

  static resetTokenCaches (cacheDir) {
    let cachePath = cacheDir || mcDefaultFolderPath
    try {
      if (fs.existsSync(cachePath + '/nmp-cache')) {
        cachePath += '/nmp-cache'
        fs.rmdirSync(cachePath, { recursive: true })
        return true
      }
    } catch (e) {
      console.log('Failed to clear cache dir', e)
      return false
    }
  }

  async getMsaToken () {
    if (await this.msa.verifyTokens()) {
      debug('[msa] Using existing tokens')
      return this.msa.getAccessToken().token
    } else {
      debug('[msa] Not using existing, need to sign in')
      const ret = await this.msa.authDeviceCode((response) => {
        console.info('[msa] First time signing in. Please authenticate now:')
        console.info(response.message)
        // console.log('Data', data)
        if (this.codeCallback) this.codeCallback(response)
      })

      console.info(`[msa] Signed in as ${ret.account.username}`)

      debug('[msa] got auth result', ret)
      return ret.accessToken
    }
  }

  async getXboxToken () {
    if (await this.xbl.verifyTokens()) {
      debug('[xbl] Using existing tokens')
      return this.xbl.getCachedXstsToken().data
    } else {
      debug('[xbl] Need to obtain tokens')
      return await retry(async () => {
        const msaToken = await this.getMsaToken()
        const ut = await this.xbl.getUserToken(msaToken)
        const xsts = await this.xbl.getXSTSToken(ut)
        return xsts
      }, () => { this.msa.forceRefresh = true }, 1)
    }
  }

  async getMinecraftToken () {
    if (await this.mca.verifyTokens()) {
      debug('[mc] Using existing tokens')
      return this.mca.getCachedAccessToken().token
    } else {
      debug('[mc] Need to obtain tokens')
      return await retry(async () => {
        const xsts = await this.getXboxToken()
        debug('[xbl] xsts data', xsts)
        return this.mca.getAccessToken(xsts)
      }, () => { this.xbl.forceRefresh = true }, 1)
    }
  }
}

async function postAuthenticate (client, options, mcAccessToken, msa) {
  options.haveCredentials = mcAccessToken != null

  let minecraftProfile
  const res = await fetch(authConstants.MinecraftServicesProfile, getFetchOptions)
  if (res.ok) { // res.status >= 200 && res.status < 300
    minecraftProfile = res.json()
  } else {
    const user = msa ? msa.getUsers()[0] : options.username
    // debug(user)
    throw Error(`Failed to obtain Minecraft profile data for '${user?.username}', does the account own Minecraft Java? Server returned: ${res.statusText}`)
  }

  if (!minecraftProfile.id) throw Error('This user does not own minecraft according to minecraft services.')

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
    console.debug('Acquired Minecraft token', token)

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

function sha1 (data) {
  return crypto.createHash('sha1').update(data || '', 'binary').digest('hex')
}

module.exports = {
  authenticatePassword,
  authenticateDeviceCode
}

async function msaTest () {
  // MsAuthFlow.resetTokenCaches()
  await authenticateDeviceCode({ emit: () => { } }, {})
}

// debug with node microsoftAuth.js
if (!module.parent) {
  msaTest()
}
