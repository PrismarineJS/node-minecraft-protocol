var https = require('https');
var fs = require('fs');
var version = require("./src/version");

var request = https.get("https://s3.amazonaws.com/Minecraft.Download/versions/"+version.minecraftVersion+"/minecraft_server."+version.minecraftVersion+".jar", function(response) {
  if(response.statusCode==200) {
    var file = fs.createWriteStream(process.argv[2]);
    response.pipe(file);
  }
  else
    process.exit(1);
});
