const net = require('net')
const dns = require('dns').promises

const debug = require('debug')('minecraft-protocol')

module.exports = function (client, options) {
  // Default options
  options.port = options.port || 25565
  options.host = options.host || 'localhost'

  if (!options.connect) {
    options.connect = async (client) => {
      // Use stream if provided
      if (options.stream) {
        client.setSocket(options.stream)
        return client.emit('connect')
      }

      // If port was not defined (defaults to 25565), host is not an ip and is not localhost
      if (options.port === 25565 && net.isIP(options.host) === 0 && options.host !== 'localhost') {
        // Try to resolve SRV records for the comain
        try {
          const resolved = await dns.resolveSrv(`_minecraft._tcp.${options.host}`)
          const [{ name, port }] = resolved

          debug(`[DNS] SRV Lookup: ${name}:${port}`)

          options.host = name
          options.port = port
        } catch (error) {
          if (error.code && error.code === 'ENOTFOUND') debug('[DNS] Host does not seem to use an SRV record...')
          else debug(`[DNS] SRV Resolve Failed: ${error}`)
        } finally {
          client.setSocket(net.connect(options.port, options.host))
        }
      } else {
        client.setSocket(net.connect(options.port, options.host))
      }
      client.setSocket(net.connect(options.port, options.host))
    }
  }
}
