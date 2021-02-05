const net = require('net')
const { Resolver } = require('dns').promises;
const resolver = new Resolver();
const debug = require('debug')('minecraft-protocol')

module.exports = (client, options) => {
  // Default options
  options.port = options.port || 25565
  options.host = options.host || 'localhost'
  if (options.connect) return
  options.connect = (passedClient) => connect(passedClient, options)
}

async function connect (client, options) {
  // Use stream if provided
  if (options.stream) {
    client.setSocket(options.stream)
    client.emit('connect')
    return
  }

  // If port was not defined (defauls to 25565), host is not an ip neither localhost
  if (
    options.port === 25565 &&
    net.isIP(options.host) === 0 &&
    options.host !== 'localhost'
  ) {
    // Try to resolve SRV records for the comain
    try {
      const addresses = await resolver.resolveSrv(`_minecraft._tcp.${options.host}`)
      const [address] = addresses
      const { name, port } = address
      // SRV Lookup resolved conrrectly
      if (addresses.length > 0) {
        options.host = name
        options.port = port
        client.setSocket(net.connect(port, name))
      } else {
        // Otherwise, just connect using the provided hostname and port
        client.setSocket(net.connect(options.port, options.host))
      }
    } catch (err) { // Error resolving domain
      // Could not resolve SRV lookup, connect directly
      debug(`srv lookup failed: ${err}`)
      client.setSocket(net.connect(options.port, options.host))
    }
  } else {
    // Otherwise, just connect using the provided hostname and port
    client.setSocket(net.connect(options.port, options.host))
  }
}
