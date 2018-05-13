module.exports = function (client, server, {
  kickTimeout = 30 * 1000,
  checkTimeoutInterval = 4 * 1000,
  keepAlive: enableKeepAlive = true
}) {
  let keepAlive = false
  let lastKeepAlive = null
  let keepAliveTimer = null
  let sendKeepAliveTime

  function keepAliveLoop () {
    if (!keepAlive) { return }

    // check if the last keepAlive was too long ago (kickTimeout)
    const elapsed = new Date() - lastKeepAlive
    if (elapsed > kickTimeout) {
      client.end('KeepAliveTimeout')
      return
    }
    sendKeepAliveTime = new Date()
    client.write('keep_alive', {
      keepAliveId: Math.floor(Math.random() * 2147483648)
    })
  }

  function onKeepAlive () {
    if (sendKeepAliveTime) client.latency = (new Date()) - sendKeepAliveTime
    lastKeepAlive = new Date()
  }

  function startKeepAlive () {
    keepAlive = true
    lastKeepAlive = new Date()
    keepAliveTimer = setInterval(keepAliveLoop, checkTimeoutInterval)
    client.on('keep_alive', onKeepAlive)
  }

  if (enableKeepAlive) {
    client.on('state', state => {
      if (state === 'play') {
        startKeepAlive()
      }
    })
  }

  client.on('end', () => clearInterval(keepAliveTimer))
}
