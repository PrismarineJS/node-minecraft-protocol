module.exports = function (client, options) {
  client.on('disconnect', message => {
    if (!message.reason) { return }
    const parsed = JSON.parse(message.reason)
    let text = parsed.text ? parsed.text : parsed
    let versionRequired

    if (text.translate && text.translate.startsWith('multiplayer.disconnect.outdated_')) { versionRequired = text.with[0] } else {
      if (text.extra) text = text.extra[0].text
      versionRequired = /(?:Outdated client! Please use|Outdated server! I'm still on) (.+)/.exec(text)
      versionRequired = versionRequired ? versionRequired[1] : null
    }

    if (!versionRequired) { return }
    client.end()
    client.emit('error', new Error('This server is version ' + versionRequired +
      ', you are using version ' + client.version + ', please specify the correct version in the options.'))
  })
}
