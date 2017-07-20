module.exports=function(client,server,{kickTimeout = 30 * 1000,checkTimeoutInterval = 4 * 1000}) {

  let keepAlive = false;
  let lastKeepAlive = null;
  client._keepAliveTimer = null;
  let sendKeepAliveTime;


  function keepAliveLoop() {
    if(!keepAlive)
      return;

    // check if the last keepAlive was too long ago (kickTimeout)
    const elapsed = new Date() - lastKeepAlive;
    if(elapsed > kickTimeout) {
      client.end('KeepAliveTimeout');
      return;
    }
    sendKeepAliveTime = new Date();
    client.write('keep_alive', {
      keepAliveId: Math.floor(Math.random() * 2147483648)
    });
  }

  function onKeepAlive() {
    if(sendKeepAliveTime) client.latency = (new Date()) - sendKeepAliveTime;
    lastKeepAlive = new Date();
  }

  client._startKeepAlive= () => {
    keepAlive = true;
    lastKeepAlive = new Date();
    client._keepAliveTimer = setInterval(keepAliveLoop, checkTimeoutInterval);
    client.on('keep_alive', onKeepAlive);
  }

};
