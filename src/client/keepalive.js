'use strict'

module.exports = function (client, options) {
  const keepAlive = options.keepAlive == null ? true : options.keepAlive
  if (!keepAlive) return

  const checkTimeoutInterval = options.checkTimeoutInterval || 30 * 1000

  client.on('keep_alive', onKeepAlive)

  let timeout = null

  client.on('end', () => clearTimeout(timeout))

  function onKeepAlive (packet) {
    if (timeout) { clearTimeout(timeout) }
    timeout = setTimeout(() => client.end(), checkTimeoutInterval)
    client.write('keep_alive', {
      keepAliveId: packet.keepAliveId
    })
  }
}
