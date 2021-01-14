const msal = require('@azure/msal-node')
const fs = require('fs')
const path = require('path')
const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const fetch = require('node-fetch')

function debug(...message) {
  console.debug(message[0])
}

// Manages Microsoft account tokens
class MsaTokenManager {
  constructor({ msalConfig, scopes, cacheLocation }) {
    this.msaClientId = msalConfig.auth.clientId
    this.scopes = scopes

    if (!cacheLocation) cacheLocation = path.join(__dirname, './msa-cache.json')

    let beforeCacheAccess = async (cacheContext) => {
      cacheContext.tokenCache.deserialize(await fs.promises.readFile(cacheLocation, "utf-8"))
    }

    let afterCacheAccess = async (cacheContext) => {
      if (cacheContext.cacheHasChanged) {
        await fs.promises.writeFile(cacheLocation, cacheContext.tokenCache.serialize())
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

    try {
      this.msaCache = require(cacheLocation)
    } catch (e) {
      this.msaCache = {}
    }
  }

  getUsers() {
    let accounts = this.msaCache.Account
    let users = []
    for (var account of Object.values(accounts)) {
      users.push(account)
    }
    return users
  }

  getAccessToken() {
    let tokens = this.msaCache.AccessToken
    if (!tokens) return
    let account = Object.values(tokens).filter(t => t.client_id == this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid access token found', tokens)
      return
    }
    // console.log(account)
    let until = (Date.now() - new Date(account.expires_on * 1000))
    let valid = until < 1000
    return { valid, until: until * -1, token: account.secret }
  }

  getRefreshToken() {
    let tokens = this.msaCache.RefreshToken
    if (!tokens) return
    let account = Object.values(tokens).filter(t => t.client_id == this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid refresh token found', tokens)
      return
    }
    return { token: account.secret }
  }

  async refreshTokens() {
    let rtoken = this.getRefreshToken()
    if (!rtoken) {
      throw 'Cannot refresh without refresh token'
    }
    const refreshTokenRequest = {
      refreshToken: rtoken.token,
      scopes: this.scopes,
    }

    return new Promise((res, rej) => {
      this.msalApp.acquireTokenByRefreshToken(refreshTokenRequest).then((response) => {
        debug('[msa] refreshed token', JSON.stringify(response))
        res(response)
      }).catch((error) => {
        debug('[msa] failed to refresh', JSON.stringify(error))
        rej(error)
      })
    })
  }

  async verifyTokens() {
    let at = this.getAccessToken()
    let rt = this.getRefreshToken()
    if (!at || !rt) {
      return false
    }
    debug('[msa] have at, rt', at, rt)
    if (at.valid && rt) {
      return true
    } else {
      try {
        this.refreshTokens()
        return true
      } catch (e) {
        return false
      }
    }
    return false
  }

  // Authenticate with device_code flow
  async authDeviceToken(dataCallback) {
    const deviceCodeRequest = {
      deviceCodeCallback: (resp) => {
        debug('[msa] device_code response: ', resp)
        dataCallback(resp)
      },
      scopes: this.scopes
    }

    return new Promise((res, rej) => {
      this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest).then((response) => {
        debug('[msa] device_code resp', JSON.stringify(response));
        res(response)
      }).catch((error) => {
        console.warn('ERROR!', error)
        console.log('ERROR!', JSON.stringify(error));
        rej(error)
      })
    })
  }
}


// Manages Xbox Live tokens for xboxlive.com
class XboxTokenManager {
  constructor({ relayParty, cacheLocation }) {
    this.relayParty = relayParty
    if (!cacheLocation) cacheLocation = path.join(__dirname, './xbl-cache.json')
    try {
      this.cache = require(cacheLocation)
    } catch (e) {
      this.cache = {}
    }
    this.cacheLocation = cacheLocation
  }

  getCachedUserToken() {
    let token = this.cache.userToken
    if (!token) return
    let until = new Date(token.NotAfter)
    let dn = Date.now()
    let remainingMs = until - dn
    let valid = remainingMs > 1000
    return { valid, token: token.Token, data: token }
  }

  getCachedXstsToken() {
    let token = this.cache.xstsToken
    if (!token) return
    let until = new Date(token.expiresOn)
    let dn = Date.now()
    let remainingMs = until - dn
    let valid = remainingMs > 1000
    return { valid, token: token.Token, data: token }
  }

  setCachedUserToken(data) {
    this.cache.userToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  setCachedXstsToken(data) {
    this.cache.xstsToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async verifyTokens() {
    let ut = this.getCachedUserToken()
    let xt = this.getCachedXstsToken()
    if (!ut || !xt) {
      return false
    }
    debug('[xbl] have user, xsts', ut, xt)
    if (ut.valid && xt.valid) {
      return true
    } else if (ut.valid && !xt.valid) {
      try {
        this.getXSTSToken(ut.data)
      } catch (e) {
        return false
      }
    }
    return false
  }

  async getUserToken(msaAccessToken) {
    debug('[xbl] obtaining xbox token with ms token', msaAccessToken)
    if (!msaAccessToken.startsWith('d='))
      msaAccessToken = 'd=' + msaAccessToken // took way too long to figure this out
    let xblUserToken = await XboxLiveAuth.exchangeRpsTicketForUserToken(msaAccessToken)
    this.setCachedUserToken(xblUserToken)
    debug('[xbl] user token:', xblUserToken)
    return xblUserToken
  }

  async getXSTSToken(xblUserToken) {
    debug('[xbl] obtaining xsts token with xbox user token', xblUserToken.Token)
    let xsts = await XboxLiveAuth.exchangeUserTokenForXSTSIdentity(
      xblUserToken.Token, { XSTSRelyingParty: this.relayParty, raw: false }
    )
    this.setCachedXstsToken(xsts)
    debug('[xbl] xsts', xsts)
    return xsts
  }
}

// Manages Minecraft tokens for sessionserver.mojang.com 
class MinecraftTokenManager {
  constructor({ cacheLocation } = {}) {
    if (!cacheLocation) cacheLocation = path.join(__dirname, './mca-cache.json')
    try {
      this.cache = require(cacheLocation)
    } catch (e) {
      this.cache = {}
    }
    this.cacheLocation = cacheLocation
  }

  getCachedAccessToken() {
    let token = this.cache.mca
    // console.log('MC token cache', this.cache)
    if (!token) return
    let expires = token.obtainedOn + (token.expires_in * 1000)
    let remaining = expires - Date.now()
    let valid = remaining > 1000
    return { valid, until: expires, token: token.access_token, data: token }
  }

  setCachedAccessToken(data) {
    data.obtainedOn = Date.now()
    this.cache.mca = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
    // console.log('cached', data, this.cache, this.cacheLocation)
  }

  async verifyTokens() {
    let at = this.getCachedAccessToken()
    if (!at) {
      return false
    }
    debug('[mc] have user access token', at)
    if (at.valid) {
      return true
    }
    return false
  }

  async getAccessToken(xsts) {
    debug('[mc] authing to minecraft', xsts)
    const MinecraftServicesLogWithXbox = 'https://api.minecraftservices.com/authentication/login_with_xbox'
    const getFetchOptions = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'node-minecraft-protocol'
      }
    }
    const MineServicesResponse = await fetch(MinecraftServicesLogWithXbox, {
      method: 'post',
      ...getFetchOptions,
      body: JSON.stringify({ identityToken: `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}` })
    }).then(checkStatus)
  
    debug('[mc] mc auth response', MineServicesResponse)
    this.setCachedAccessToken(MineServicesResponse)
    return MineServicesResponse.access_token
  }

  async verifyEntitlements() {
    // TODO
  }
}

if (typeof btoa === 'undefined') {
  global.btoa = function (str) {
    return new Buffer(str, 'binary').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function (b64Encoded) {
    return new Buffer(b64Encoded, 'base64').toString('binary');
  };
}

function checkStatus(res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res.json()
  } else {
    throw Error(res.statusText)
  }
}

module.exports = { MsaTokenManager, XboxTokenManager, MinecraftTokenManager }