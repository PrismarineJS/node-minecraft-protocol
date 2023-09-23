module.exports = function (client, options) {
  client.once('compress', onCompressionRequest)
  client.on('set_compression', onCompressionRequest)

  function onCompressionRequest (packet) {
    client.compressionThreshold = packet.threshold
  }
  // TODO: refactor with transforms/compression.js -- enable it here
}
