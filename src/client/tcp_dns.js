const net = require('net')
const dns = require('dns')

const debug = require('debug')('minecraft-protocol')

module.exports = function (client, options) {
  // Default options
  options.port = options.port || 25565
  options.host = options.host || 'localhost'

  if (!options.connect) {
    options.connect = (client) => {
      // Use stream if provided
      if (options.stream) {
        client.setSocket(options.stream)
        return client.emit('connect')
      }

      // If port was not defined (defaults to 25565), host is not an ip and is not localhost
      if (options.port === 25565 && net.isIP(options.host) === 0 && options.host !== 'localhost') {
        // Try to resolve SRV records for the comain
        dns.resolveSrv(`_minecraft._tcp.${options.host}`, (err, addresses) => {
          // Error resolving domain
          if (err) debug(`srv lookup failed: ${err}`)

          // SRV Lookup resolved correctly
          if (addresses && addresses.length > 0) {
            debug(`srv lookup returned ${addresses}`)
            options.host = addresses[0].name
            options.port = addresses[0].port
          }
        })
      }
      return client.setSocket(net.connect(options.port, options.host))
    }
  }
}
