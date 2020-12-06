const UUID = require('uuid-1345')
const yggdrasil = require('yggdrasil')

module.exports = function (client, options) {
  const yggdrasilClient = yggdrasil({ agent: options.agent, host: options.authServer || 'https://authserver.mojang.com' })
  const clientToken = options.clientToken || (options.session && options.session.clientToken) || UUID.v4().toString()
  const skipValidation = false || options.skipValidation
  options.accessToken = null
  options.haveCredentials = options.password != null || (clientToken != null && options.session != null)

  if (options.haveCredentials) {
    // make a request to get the case-correct username before connecting.
    const cb = function (err, session) {
      if (err) {
        client.emit('error', err)
      } else {
        client.session = session
        client.username = session.selectedProfile.name
        options.accessToken = session.accessToken
        client.emit('session', session)
        options.connect(client)
      }
    }

    if (options.session) {
      if (!skipValidation) {
        yggdrasilClient.validate(options.session.accessToken, function (err) {
          if (!err) { cb(null, options.session) } else {
            yggdrasilClient.refresh(options.session.accessToken, options.session.clientToken, function (err, accessToken, data) {
              if (!err) {
                cb(null, data)
              } else if (options.username && options.password) {
                yggdrasilClient.auth({
                  user: options.username,
                  pass: options.password,
                  token: clientToken
                }, cb)
              } else {
                cb(err, data)
              }
            })
          }
        })
      } else {
        // trust that the provided session is a working one
        cb(null, options.session)
      }
    } else {
      yggdrasilClient.auth({
        user: options.username,
        pass: options.password,
        token: clientToken
      }, cb)
    }
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username
    options.connect(client)
  }
}
