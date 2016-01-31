module.exports = function(client) {
  var options = client.options;
  var keepAlive = options.keepAlive == null ? true : options.keepAlive;
  if (!keepAlive) return;

  var checkTimeoutInterval = options.checkTimeoutInterval || 10 * 1000;

  client.on('keep_alive', onKeepAlive);

  var timeout = null;

  function onKeepAlive(packet) {
    if (timeout)
      clearTimeout(timeout);
    timeout = setTimeout(() => client.end(), checkTimeoutInterval);
    client.write('keep_alive', {
      keepAliveId: packet.keepAliveId
    });
  }

};
