const states = require('../states')

module.exports = function (client, options) {
  client.on('disconnect', message => {
    if (!message.reason) { return }
    // Prevent the disconnect packet handler in the versionChecking code from triggering on PLAY or CONFIGURATION state disconnects
    // Since version checking only happens during that HANDSHAKE / LOGIN state.
    if (client.state === states.PLAY || client.state === states.CONFIGURATION) { return }
    let parsed
    try {
      parsed = JSON.parse(message.reason)
    } catch (error) {
      return
    }
    let text = parsed.text ? parsed.text : parsed
    let versionRequired

    if (text.translate && (text.translate.startsWith('multiplayer.disconnect.outdated_') || text.translate.startsWith('multiplayer.disconnect.incompatible'))) {
      versionRequired = text.with[0]
    } else {
      if (text.extra) text = text.extra[0].text
      versionRequired = /(?:Outdated client! Please use|Outdated server! I'm still on) (.+)/.exec(text)
      versionRequired = versionRequired ? versionRequired[1] : null
    }

    if (!versionRequired) { return }
    client.emit('error', new Error('This server is version ' + versionRequired +
    ', you are using version ' + client.version + ', please specify the correct version in the options.'))
    client.end('differentVersionError')
  })
}
