const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const msal = require('@azure/msal-node')
const fetch = require('node-fetch')
const { MsaTokenManager, XboxTokenManager, MinecraftTokenManager } = require('./tokens')

const getFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'node-minecraft-protocol'
  }
}

const XSTSRelyingParty = 'rp://api.minecraftservices.com/'
const MinecraftServicesLogWithXbox = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MinecraftServicesEntitlement = 'https://api.minecraftservices.com/entitlements/mcstore'
const MinecraftServicesProfile = 'https://api.minecraftservices.com/minecraft/profile'

// Initialize msal

// See https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/request.md#public-apis-1
// for docs
const msalConfig = {
  auth: {
    // the minecraft client:
    // clientId: "000000004C12AE6F",
    // clientId: '389b1b32-b5d5-43b2-bddc-84ce938d6737', // token from https://github.com/microsoft/Office365APIEditor
    clientId: '60bad957-e36a-472d-a72a-612ad7f66b46', // @extremeheat
    // clientId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264', // MS Teams
    authority: "https://login.microsoftonline.com/consumers"
    // test out using live.com:
    // validateAuthority: false,
    // knownAuthorities: ["login.live.com"],
    // protocolMode: 'OIDC',

    // authority: 'https://login.live.com'
  },
  // cache: {
  //   cachePlugin // your implementation of cache plugin
  // },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        // console.log('[msal] ', this.logLevel, message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    }
  }
}

let scopes = ['XboxLive.signin', 'offline_access']
let msa = new MsaTokenManager({ msalConfig, scopes })
let relayParty = 'rp://api.minecraftservices.com/'
let xbl = new XboxTokenManager({ relayParty })
let mca = new MinecraftTokenManager()

// async function authenticateMsa() {
//   if (await msa.verifyTokens()) { // We have valid tokens
//     console.debug('[msa] re-using existing tokens')
//     return msa.getAccessToken()
//   }

//   let ret = await msa.authDeviceToken((response) => {
//     console.info('[msa] First time signing in. Please authenticate now:')
//     console.info(response.message)
//     // console.log('Data', data)
//   })

//   console.info(`[msa] Signed in as ${ret.account.username}`)

//   console.log(ret)
//   return ret.accessToken
// }

function debug(...message) {
  console.debug(message[0])
}

// async function authenticateXbl(msaAccessToken) {
//   debug('[xbl] obtaining xbox token with ms token', msaAccessToken)

//   if (await xbl.verifyTokens()) {
//     debug('[xbl] re-using existing xbox tokens')
//     return xbl.getCachedXstsToken().data
//   }

//   let ut = await xbl.getUserToken(msaAccessToken)
//   let xt = await xbl.getXSTSToken(ut)

//   console.log(xt)
//   return xt
// }

// async function authenticateMinecraft(xsts) {
//   if (await mca.verifyTokens()) {
//     debug('[msa] re-using existing xbox tokens')
//     return mca.getCachedAccessToken().token
//   }
//   let mctoken = await mca.getAccessToken(xsts)
//   debug('Minecraft token: ', mctoken)
//   return mctoken
// }

async function postAuthenticate(client, options, mcAccessToken) {
  options.haveCredentials = mcAccessToken != null

  const MinecraftProfile = await fetch(MinecraftServicesProfile, getFetchOptions).then((res) => {
    if (res.ok) { // res.status >= 200 && res.status < 300
      return res.json()
    } else {
      let user = msa.getUsers()[0]
      debug(user)
      console.error(`Failed to obtain Minecraft profile data for '${ user.username }', does the account own Minecraft Java?`)
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
  options.accessToken = MineServicesResponse.access_token
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
async function authenticatePassword(client, options) {
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

  getFetchOptions.headers.Authorization = `Bearer ${MineServicesResponse.access_token}`
  const MineEntitlements = await fetch(MinecraftServicesEntitlement, getFetchOptions).then(checkStatus)
  if (MineEntitlements.items.length === 0) throw Error('This user does not have any items on its accounts according to minecraft services.')

  postAuthenticate(client, options, MineServicesResponse.access_token)
}

async function getMsaToken() {
  if (await msa.verifyTokens()) {
    return msa.getAccessToken().token
  } else {
    let ret = await msa.authDeviceToken((response) => {
      console.info('[msa] First time signing in. Please authenticate now:')
      console.info(response.message)
      // console.log('Data', data)
    })
  
    console.info(`[msa] Signed in as ${ret.account.username}`)
  
    debug(ret)
    return ret.accessToken
  }
}

async function getXboxToken() {
  if (await xbl.verifyTokens()) {
    return xbl.getCachedXstsToken().data
  } else {
    let msaToken = await getMsaToken()
    let ut = await xbl.getUserToken(msaToken)
    let xsts = await xbl.getXSTSToken(ut)
    return xsts.data
  }
}

async function getMinecraftToken() {
  if (await mca.verifyTokens()) {
    return mca.getCachedAccessToken().token
  } else {
    let xsts = await getXboxToken()
    return mca.getAccessToken(xsts)
  }
}

async function authenticateDeviceToken(client, options) {
  let token = await getMinecraftToken()
  console.debug('Aquired Minecraft token', token)

  postAuthenticate(client, options, token)
}

function checkStatus(res) {
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

// async function msaTest() {
//   let msaToken = await authenticateMsa()
//   let xblToken = await authenticateXbl(msaToken.token)
//   let mcToken = await authenticateMinecraft(xblToken)
//   // let tm = new TokenManager('389b1b32-b5d5-43b2-bddc-84ce938d6737')
// }

async function msaTest() {
  await authenticateDeviceToken({}, {})
}

// debug with node microsoftAuth.js
if (!module.parent) {
  msaTest()
}
