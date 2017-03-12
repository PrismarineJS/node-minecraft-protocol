module.exports = function(client,options) {
  client.on("disconnect",message => {
    if(!message.reason)
      return;
    const parsed=JSON.parse(message.reason);
    const text=parsed.text ? parsed.text : parsed;
    const versionRequired=/(?:Outdated client! Please use|Outdated server! I'm still on) (.+)/.exec(text);
    if(!versionRequired)
      return;
    client.emit("error",new Error("This server is version "+versionRequired[1]+
      ", you are using version "+client.version+", please specify the correct version in the options."))
  })
};
