var states = require('../index').states

module.exports = function(opts, client) {
  if (client.isServer)
    installKeepaliveServer(opts, client);
  else
    installKeepaliveClient(opts, client);
};

function installKeepaliveServer(opts, client) {
  // If the server doesn't hear from the client for 30 seconds, the client
  // gets kicked
  var timeout = opts.timeout || 30 * 1000;
  var checkInterval = opts.checkInterval || 4 * 1000;
  var lastKeepAliveDate = 0;
  var lastKeepAliveId = -1;
  var interval = null;

  function keepAliveLoop() {
    var elapsed = new Date() - lastKeepAliveDate;
    if (elapsed > timeout)
      return client.end('KeepAliveTimeout');
    else {
      lastKeepAliveId = Math.floor(Math.random() * (2 ** 31))
      client.write('keepalive', {keepaliveId: lastKeepAliveId });
    }
  }

  if (client.state !== states.PLAY) {
    client.once('state', function(newstate) {
      if (newstate === states.PLAY)
        interval = setInterval(keepAliveLoop, checkInterval);
    });
  } else {
    interval = setInterval(keepAliveLoop, checkInterval);
  }

  client.on('keepalive', function(packet) {
    // TODO : Figure out what to do if the client sent the wrong keepaliveId
    lastKeepAliveDate = new Date();
  });

  client.on('end', function() {
    clearInterval(interval);
  });
}

function installKeepaliveClient(opts, client) {
  // If the client doesn't hear from the server for 20 seconds, the client
  // disconnects
  var serverTimeout = opts.timeout || 20 * 1000;
  // TODO : implement server timeout
  client.on('keepalive', function(packet) {
    client.write('keepalive', { keepAliveId: packet.keepAliveId });
  });
}
