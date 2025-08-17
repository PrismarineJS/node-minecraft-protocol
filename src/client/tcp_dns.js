const net = require('net')
const dns = require('dns')
const { createProxyConnect } = require('./proxy')

module.exports = function (client, options) {
  // Default options
  options.port = options.port || 25565
  options.host = options.host || 'localhost'

  if (!options.connect) {
    options.connect = (client) => {
      // Use stream if provided
      if (options.stream) {
        client.setSocket(options.stream)
        client.emit('connect')
        return
      }

      // Helper function to connect (direct or via proxy)
      const connectToTarget = (targetHost, targetPort) => {
        if (options.proxy) {
          const proxyConnect = createProxyConnect(options.proxy, targetHost, targetPort)
          proxyConnect(client)
        } else {
          client.setSocket(net.connect(targetPort, targetHost))
        }
      }

      // If port was not defined (defauls to 25565), host is not an ip neither localhost
      if (options.port === 25565 && net.isIP(options.host) === 0 && options.host !== 'localhost') {
        // Try to resolve SRV records for the comain
        dns.resolveSrv('_minecraft._tcp.' + options.host, (err, addresses) => {
          // Error resolving domain
          if (err) {
            // Could not resolve SRV lookup, connect directly
            connectToTarget(options.host, options.port)
            return
          }

          // SRV Lookup resolved conrrectly
          if (addresses && addresses.length > 0) {
            connectToTarget(addresses[0].name, addresses[0].port)
          } else {
            // Otherwise, just connect using the provided hostname and port
            connectToTarget(options.host, options.port)
          }
        })
      } else {
        // Otherwise, just connect using the provided hostname and port
        connectToTarget(options.host, options.port)
      }
    }
  }
}
