module.exports = function(client,options) {
  client.on("disconnect",message => {
    if(!message.reason)
      return;
    const versionRequired=/Outdated client! Please use (.+)/.exec(JSON.parse(message.reason).text);
    if(!versionRequired)
      return;
    client.emit("error",new Error("This server is version "+versionRequired[1]+
      ", you are using version "+client.version+", please specify the correct version in the options."))
  })
};
