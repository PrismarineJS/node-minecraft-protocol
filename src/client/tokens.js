const msal = require('@azure/msal-node')
const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const debug = require('debug')('minecraft-protocol')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const authConstants = require('./authConstants')

// Manages Microsoft account tokens
class MsaTokenManager {
  constructor (msalConfig, scopes, cacheLocation) {
    this.msaClientId = msalConfig.auth.clientId
    this.scopes = scopes
    this.cacheLocation = cacheLocation || path.join(__dirname, './msa-cache.json')

    this.reloadCache()

    const beforeCacheAccess = async (cacheContext) => {
      cacheContext.tokenCache.deserialize(await fs.promises.readFile(this.cacheLocation, 'utf-8'))
    }

    const afterCacheAccess = async (cacheContext) => {
      if (cacheContext.cacheHasChanged) {
        await fs.promises.writeFile(this.cacheLocation, cacheContext.tokenCache.serialize())
      }
    }

    const cachePlugin = {
      beforeCacheAccess,
      afterCacheAccess
    }

    msalConfig.cache = {
      cachePlugin
    }
    this.msalApp = new msal.PublicClientApplication(msalConfig)
    this.msalConfig = msalConfig
  }

  reloadCache () {
    try {
      this.msaCache = require(this.cacheLocation)
    } catch (e) {
      this.msaCache = {}
      fs.writeFileSync(this.cacheLocation, JSON.stringify(this.msaCache))
    }
  }

  getUsers () {
    const accounts = this.msaCache.Account
    const users = []
    if (!accounts) return users
    for (const account of Object.values(accounts)) {
      users.push(account)
    }
    return users
  }

  getAccessToken () {
    const tokens = this.msaCache.AccessToken
    if (!tokens) return
    const account = Object.values(tokens).filter(t => t.client_id === this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid access token found', tokens)
      return
    }
    const until = new Date(account.expires_on * 1000) - Date.now()
    const valid = until > 1000
    return { valid, until: until, token: account.secret }
  }

  getRefreshToken () {
    const tokens = this.msaCache.RefreshToken
    if (!tokens) return
    const account = Object.values(tokens).filter(t => t.client_id === this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid refresh token found', tokens)
      return
    }
    return { token: account.secret }
  }

  async refreshTokens () {
    const rtoken = this.getRefreshToken()
    if (!rtoken) {
      throw new Error('Cannot refresh without refresh token')
    }
    const refreshTokenRequest = {
      refreshToken: rtoken.token,
      scopes: this.scopes
    }

    return new Promise((resolve, reject) => {
      this.msalApp.acquireTokenByRefreshToken(refreshTokenRequest).then((response) => {
        debug('[msa] refreshed token', JSON.stringify(response))
        this.reloadCache()
        resolve(response)
      }).catch((error) => {
        debug('[msa] failed to refresh', JSON.stringify(error))
        reject(error)
      })
    })
  }

  async verifyTokens () {
    const at = this.getAccessToken()
    const rt = this.getRefreshToken()
    if (!at || !rt || this.forceRefresh) {
      return false
    }
    debug('[msa] have at, rt', at, rt)
    if (at.valid && rt) {
      return true
    } else {
      try {
        await this.refreshTokens()
        return true
      } catch (e) {
        return false
      }
    }
  }

  // Authenticate with device_code flow
  async authDeviceCode (dataCallback) {
    const deviceCodeRequest = {
      deviceCodeCallback: (resp) => {
        debug('[msa] device_code response: ', resp)
        dataCallback(resp)
      },
      scopes: this.scopes
    }

    return new Promise((resolve, reject) => {
      this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest).then((response) => {
        debug('[msa] device_code resp', JSON.stringify(response))
        if (!this.msaCache.Account) this.msaCache.Account = { '': response.account }
        resolve(response)
      }).catch((error) => {
        console.warn('[msa] Error getting device code')
        console.debug(JSON.stringify(error))
        reject(error)
      })
    })
  }
}

// Manages Xbox Live tokens for xboxlive.com
class XboxTokenManager {
  constructor (relyingParty, cacheLocation) {
    this.relyingParty = relyingParty
    this.cacheLocation = cacheLocation || path.join(__dirname, './xbl-cache.json')
    try {
      this.cache = require(this.cacheLocation)
    } catch (e) {
      this.cache = {}
    }
  }

  getCachedUserToken () {
    const token = this.cache.userToken
    if (!token) return
    const until = new Date(token.NotAfter)
    const dn = Date.now()
    const remainingMs = until - dn
    const valid = remainingMs > 1000
    return { valid, token: token.Token, data: token }
  }

  getCachedXstsToken () {
    const token = this.cache.xstsToken
    if (!token) return
    const until = new Date(token.expiresOn)
    const dn = Date.now()
    const remainingMs = until - dn
    const valid = remainingMs > 1000
    return { valid, token: token.XSTSToken, data: token }
  }

  setCachedUserToken (data) {
    this.cache.userToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  setCachedXstsToken (data) {
    this.cache.xstsToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async verifyTokens () {
    const ut = this.getCachedUserToken()
    const xt = this.getCachedXstsToken()
    if (!ut || !xt || this.forceRefresh) {
      return false
    }
    debug('[xbl] have user, xsts', ut, xt)
    if (ut.valid && xt.valid) {
      return true
    } else if (ut.valid && !xt.valid) {
      try {
        await this.getXSTSToken(ut.data)
        return true
      } catch (e) {
        return false
      }
    }
    return false
  }

  async getUserToken (msaAccessToken) {
    debug('[xbl] obtaining xbox token with ms token', msaAccessToken)
    if (!msaAccessToken.startsWith('d=')) { msaAccessToken = 'd=' + msaAccessToken }
    const xblUserToken = await XboxLiveAuth.exchangeRpsTicketForUserToken(msaAccessToken)
    this.setCachedUserToken(xblUserToken)
    debug('[xbl] user token:', xblUserToken)
    return xblUserToken
  }

  async getXSTSToken (xblUserToken) {
    debug('[xbl] obtaining xsts token with xbox user token', xblUserToken.Token)
    const xsts = await XboxLiveAuth.exchangeUserTokenForXSTSIdentity(
      xblUserToken.Token, { XSTSRelyingParty: this.relyingParty, raw: false }
    )
    this.setCachedXstsToken(xsts)
    debug('[xbl] xsts', xsts)
    return xsts
  }
}

// Manages Minecraft tokens for sessionserver.mojang.com
class MinecraftTokenManager {
  constructor (cacheLocation) {
    this.cacheLocation = cacheLocation || path.join(__dirname, './mca-cache.json')
    try {
      this.cache = require(this.cacheLocation)
    } catch (e) {
      this.cache = {}
    }
  }

  getCachedAccessToken () {
    const token = this.cache.mca
    debug('[mc] token cache', this.cache)
    if (!token) return
    const expires = token.obtainedOn + (token.expires_in * 1000)
    const remaining = expires - Date.now()
    const valid = remaining > 1000
    return { valid, until: expires, token: token.access_token, data: token }
  }

  setCachedAccessToken (data) {
    data.obtainedOn = Date.now()
    this.cache.mca = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async verifyTokens () {
    const at = this.getCachedAccessToken()
    if (!at || this.forceRefresh) {
      return false
    }
    debug('[mc] have user access token', at)
    if (at.valid) {
      return true
    }
    return false
  }

  async getAccessToken (xsts) {
    debug('[mc] authing to minecraft', xsts)
    const getFetchOptions = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'node-minecraft-protocol'
      }
    }
    const MineServicesResponse = await fetch(authConstants.MinecraftServicesLogWithXbox, {
      method: 'post',
      ...getFetchOptions,
      body: JSON.stringify({ identityToken: `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}` })
    }).then(checkStatus)

    debug('[mc] mc auth response', MineServicesResponse)
    this.setCachedAccessToken(MineServicesResponse)
    return MineServicesResponse.access_token
  }
}

function checkStatus (res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res.json()
  } else {
    throw Error(res.statusText)
  }
}

module.exports = { MsaTokenManager, XboxTokenManager, MinecraftTokenManager }
