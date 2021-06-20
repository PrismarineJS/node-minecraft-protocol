const encrypt = require('./encrypt')
const keepalive = require('./keepalive')
const compress = require('./compress')
const auth = require('./auth')
const microsoftAuth = require('./microsoftAuth')
const setProtocol = require('./setProtocol')
const play = require('./play')
const tcpDns = require('./tcp_dns')
const autoVersion = require('./autoVersion')
const pluginChannels = require('./pluginChannels')
const versionChecking = require('./versionChecking')

module.exports = {
    encrypt,
    keepalive,
    compress,
    auth,
    microsoftAuth,
    setProtocol,
    play,
    tcpDns,
    autoVersion,
    pluginChannels,
    versionChecking
}