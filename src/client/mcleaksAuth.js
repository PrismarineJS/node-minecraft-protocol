const mcleaks = require("node-mcleaks")

module.export = function(client, options) { 
  mcleaks.redeem( { token: options.username} , (err, data) => { 
    if(err) throw err
    let accountData = data.result
    client.mcleaksSession = accountData.session
    client.username = accountData.mcname
    options.connect(client)
  } );
 } 
