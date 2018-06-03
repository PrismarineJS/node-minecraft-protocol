const yggdrasil = require('yggdrasil')({})
const UUID = require('uuid-1345')

module.exports = function (client, options) {
  const clientToken = options.clientToken || (options.session && options.session.clientToken) || UUID.v4().toString()
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
      yggdrasil.validate(options.session.accessToken, function (err) {
        if (!err) { cb(null, options.session) } else {
          yggdrasil.refresh(options.session.accessToken, options.session.clientToken, function (err, accessToken, data) {
            if (!err) {
              cb(null, data)
            } else if (options.username && options.password) {
              yggdrasil.auth({
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
      yggdrasil.auth({
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
