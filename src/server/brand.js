const PLAY = require('../states').PLAY
module.exports = (client, server) => {
  client.sendBrand = (brand = server.serverBrand) => {
    if (client.state !== PLAY) throw new Error(`The state of the client must be PLAY (actual state: ${client.state})`)
    client.writeChannel((
      client.protocolVersion >= 385 // (385 = 1.13-pre3) as of 1.13 (The Flattening), the name of the default channels has changed
        ? 'brand'
        : 'MC|Brand'
    ), brand)
  }
}
