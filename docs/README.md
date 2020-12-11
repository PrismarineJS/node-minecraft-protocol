# minecraft protocol
[![NPM version](https://img.shields.io/npm/v/minecraft-protocol.svg)](https://www.npmjs.com/package/minecraft-protocol)
[![Build Status](https://github.com/PrismarineJS/node-minecraft-protocol/workflows/CI/badge.svg)](https://github.com/PrismarineJS/node-minecraft-protocol/actions?query=workflow%3A%22CI%22)
[![Discord](https://img.shields.io/badge/chat-on%20discord-brightgreen.svg)](https://discord.gg/GsEFRM8)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-brightgreen.svg)](https://gitter.im/PrismarineJS/general)
[![Irc](https://img.shields.io/badge/chat-on%20irc-brightgreen.svg)](https://irc.gitter.im/)

[![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/PrismarineJS/node-minecraft-protocol)

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft PC version 1.7.10, 1.8.8, 1.9 (15w40b, 1.9, 1.9.1-pre2, 1.9.2, 1.9.4),
  1.10 (16w20a, 1.10-pre1, 1.10, 1.10.1, 1.10.2), 1.11 (16w35a, 1.11, 1.11.2), 1.12 (17w15a, 17w18b, 1.12-pre4, 1.12, 1.12.1, 1.12.2), and 1.13 (17w50a, 1.13, 1.13.1, 1.13.2-pre1, 1.13.2-pre2, 1.13.2), 1.14 (1.14, 1.14.1, 1.14.3, 1.14.4)
  , 1.15 (1.15, 1.15.1, 1.15.2) and 1.16 (20w13b, 20w14a, 1.16-rc1, 1.16, 1.16.1, 1.16.2, 1.16.3, 1.16.4)
 * Parses all packets and emits events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * Client
   - Authenticating and logging in
   - Encryption
   - Compression
   - Both online and offline mode
   - Respond to keep-alive packets.
   - Ping a server for status
 * Server
   - Online/Offline mode
   - Encryption
   - Compression
   - Handshake
   - Keep-alive checking
   - Ping status
 * Robust test coverage.
 * Optimized for rapidly staying up to date with Minecraft protocol updates.
 
Want to contribute on something important for PrismarineJS ? go to https://github.com/PrismarineJS/mineflayer/wiki/Big-Prismarine-projects

## Third Party Plugins

node-minecraft-protocol is pluggable.

* [minecraft-protocol-forge](https://github.com/PrismarineJS/node-minecraft-protocol-forge) add forge support to minecraft-protocol

## Projects Using node-minecraft-protocol

 * [mineflayer](https://github.com/PrismarineJS/mineflayer/) - create minecraft
   bots with a stable, high level API.
 * [mcserve](https://github.com/andrewrk/mcserve) - runs and monitors your
   minecraft server, provides real-time web interface, allow your users to
   create bots.
 * [flying-squid](https://github.com/PrismarineJS/flying-squid) create minecraft
   servers with a high level API, also a minecraft server by itself.
 * [pakkit](https://github.com/Heath123/pakkit) To monitor your packets
 * [minecraft-packet-debugger](https://github.com/wvffle/minecraft-packet-debugger) to easily debug your minecraft packets

## Usage

### Echo client example

```js
var mc = require('minecraft-protocol');
var client = mc.createClient({
  host: "localhost",   // optional
  port: 25565,         // optional
  username: "email@example.com",
  password: "12345678",
  auth: 'mojang' // optional; by default uses mojang, if using a microsoft account, set to 'microsoft'
});
client.on('chat', function(packet) {
  // Listen for chat messages and echo them back.
  var jsonMsg = JSON.parse(packet.message);
  if(jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
    var username = jsonMsg.with[0].text;
    var msg = jsonMsg.with[1];
    if(username === client.username) return;
    client.write('chat', {message: msg.text});
  }
});
```

If the server is in offline mode, you may leave out the `password` option.

### Hello World server example

```js
var mc = require('minecraft-protocol');
var server = mc.createServer({
  'online-mode': true,   // optional
  encryption: true,      // optional
  host: '0.0.0.0',       // optional
  port: 25565,           // optional
  version: '1.16.3'
});
const mcData = require('minecraft-data')(server.version)

server.on('login', function(client) {
  
  let loginPacket = mcData.loginPacket

  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 255,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  });
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });
  var msg = {
    translate: 'chat.type.announcement',
    "with": [
      'Server',
      'Hello, world!'
    ]
  };
  client.write("chat", { message: JSON.stringify(msg), position: 0, sender: '0' });
});
```

## Installation

`npm install minecraft-protocol`

## Documentation

See [doc](API.md)
See [faq](FAQ.md)


## Testing

* Ensure your system has the `java` executable in `PATH`.
* `MC_SERVER_JAR_DIR=some/path/to/store/minecraft/server/ MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

## Debugging

You can enable some protocol debugging output using `DEBUG` environment variable:

```bash
DEBUG="minecraft-protocol" node [...]
```

On windows :
```
set DEBUG=minecraft-protocol
node your_script.js
```

## Contribute

Please read https://github.com/PrismarineJS/prismarine-contribute

## History

See [history](HISTORY.md)

## Related

* [node-rcon](https://github.com/pushrax/node-rcon) can be used to access the rcon server in the minecraft server
* [map-colors][aresmapcolor] can be used to convert any image into a buffer of minecraft compatible colors

[aresmapcolor]: https://github.com/AresRPG/aresrpg-map-colors
