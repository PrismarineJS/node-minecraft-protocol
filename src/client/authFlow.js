const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const debug = require('debug')('minecraft-protocol')
const mcDefaultFolderPath = require('minecraft-folder-path')
const authConstants = require('./authConstants')
const { MsaTokenManager, XboxTokenManager, MinecraftTokenManager } = require('./tokens')

// Initialize msal
// Docs: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/request.md#public-apis-1
const msalConfig = {
  auth: {
    // the minecraft client:
    // clientId: "000000004C12AE6F",
    clientId: '389b1b32-b5d5-43b2-bddc-84ce938d6737', // token from https://github.com/microsoft/Office365APIEditor
    authority: 'https://login.microsoftonline.com/consumers'
  }
}

async function retry (methodFn, beforeRetry, times) {
  while (times--) {
    if (times !== 0) {
      try { return await methodFn() } catch (e) { debug(e) }
      await new Promise(resolve => setTimeout(resolve, 2000))
      await beforeRetry()
    } else {
      return await methodFn()
    }
  }
}

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
      debug('[msa] No valid cached tokens, need to sign in')
      const ret = await this.msa.authDeviceCode((response) => {
        console.info('[msa] First time signing in. Please authenticate now:')
        console.info(response.message)
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
      }, () => { this.msa.forceRefresh = true }, 2)
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
      }, () => { this.xbl.forceRefresh = true }, 2)
    }
  }
}

function sha1 (data) {
  return crypto.createHash('sha1').update(data || '', 'binary').digest('hex')
}

module.exports = { MsAuthFlow }
