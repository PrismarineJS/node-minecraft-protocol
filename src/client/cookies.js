'use strict'

// One map, keyed by resource location, must answer cookie requests in every state.
// `cookie_request` and `cookie_response` exist only in the login, configuration and play
// states of 1.20.5+, so the listeners never fire (nor write) elsewhere.
module.exports = function (client, options) {
  client._cookies = new Map(options.cookies instanceof Map ? options.cookies : Object.entries(options.cookies ?? {}))

  client.on('store_cookie', (packet) => {
    client._cookies.set(packet.key, packet.value)
  })

  client.on('cookie_request', (packet) => {
    let value = client._cookies.get(packet.cookie)
    if (value === undefined && !cookieValueIsOptional(client.version)) {
      // Where minecraft-data (1.21.8) declares the value as a bare ByteArray, an empty one
      // is wire-identical to an absent option: both serialize as a single 0x00 byte
      value = Buffer.alloc(0)
    }
    client.write('cookie_response', { key: packet.cookie, value })
  })
}

function cookieValueIsOptional (version) {
  const type = require('minecraft-data')(version).protocol.types.packet_common_cookie_response
  return type[1].find(field => field.name === 'value').type[0] === 'option'
}
