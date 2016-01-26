module.exports = function(client) {
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
