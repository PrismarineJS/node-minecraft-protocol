# minecraft protocol
[![NPM version](https://img.shields.io/npm/v/minecraft-protocol.svg)](https://www.npmjs.com/package/minecraft-protocol)
[![Build Status](https://github.com/PrismarineJS/node-minecraft-protocol/workflows/CI/badge.svg)](https://github.com/PrismarineJS/node-minecraft-protocol/actions?query=workflow%3A%22CI%22)
[![Discord](https://img.shields.io/badge/chat-on%20discord-brightgreen.svg)](https://discord.gg/GsEFRM8)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-brightgreen.svg)](https://gitter.im/PrismarineJS/general)
[![Irc](https://img.shields.io/badge/chat-on%20irc-brightgreen.svg)](https://irc.gitter.im/)

[![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/PrismarineJS/node-minecraft-protocol)

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft PC version
   1.7.10, 1.8.8,  1.9 (15w40b, 1.9, 1.9.1-pre2, 1.9.2, 1.9.4), 1.10 (16w20a, 1.10-pre1, 1.10, 1.10.1, 1.10.2),
   1.11 (16w35a, 1.11, 1.11.2), 1.12 (17w15a, 17w18b, 1.12-pre4, 1.12, 1.12.1, 1.12.2),
   1.13 (17w50a, 1.13, 1.13.1, 1.13.2-pre1, 1.13.2-pre2, 1.13.2),1.14 (1.14, 1.14.1, 1.14.3, 1.14.4),
   1.15 (1.15, 1.15.1, 1.15.2), 1.16 (20w13b, 20w14a, 1.16-rc1, 1.16, 1.16.1, 1.16.2, 1.16.3, 1.16.4, 1.16.5),
   1.17 (21w07a, 1.17, 1.17.1), 1.18 (1.18, 1.18.1 and 1.18.2),
   1.19 (1.19, 1.19.1, 1.19.2, 1.19.3, 1.19.4), 1.20 (1.20, 1.20.1, 1.20.2, 1.20.3, 1.20.4, 1.20.5, 1.20.6),
   1.21, 1.21.1, 1.21.3, 1.21.4, 1.21.5, 1.21.6, 1.21.8
<!--add_next_version_above-->

 * Parses all packets and emits events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * Client
   - Authenticating and logging in
   - Encryption
   - Compression
   - Both online and offline mode
   - Respond to keep-alive packets
   - Follow DNS service records (SRV)
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

 * [mineflayer](https://github.com/PrismarineJS/mineflayer/) - Create minecraft
   bots with a stable, high level API.
 * [mcserve](https://github.com/andrewrk/mcserve) - Runs and monitors your
   minecraft server, provides real-time web interface, allow your users to
   create bots.
 * [flying-squid](https://github.com/PrismarineJS/flying-squid) - Create minecraft
   servers with a high level API, also a minecraft server by itself.
 * [pakkit](https://github.com/Heath123/pakkit) - A GUI tool to monitor Minecraft packets in real time, allowing you to view their data and interactively edit and resend them.
 * [minecraft-packet-debugger](https://github.com/wvffle/minecraft-packet-debugger) - A tool to capture Minecraft packets in a buffer then view them in a browser.
 * [aresrpg](https://github.com/aresrpg/aresrpg) - An open-source mmorpg minecraft server.
 * [SteveProxy](https://github.com/SteveProxy/proxy) - Proxy for Minecraft with the ability to change the gameplay using plugins.
 * and [several thousands others](https://github.com/PrismarineJS/node-minecraft-protocol/network/dependents?package_id=UGFja2FnZS0xODEzMDk0OQ%3D%3D)

## Installation

`npm install minecraft-protocol`

## Documentation

* [API doc](API.md)
* [faq](FAQ.md)
* [protocol doc](https://prismarinejs.github.io/minecraft-data/?d=protocol) and [wiki.vg/Protocol](https://wiki.vg/Protocol)

## Usage

### Echo client example

```js
const mc = require('minecraft-protocol');
const client = mc.createClient({
  host: "localhost",   // optional
  port: 25565,                 // set if you need a port that isn't 25565
  username: 'Bot',             // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  // version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
  // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
});

client.on('playerChat', function (ev) {
  // Listen for chat messages and echo them back.
  const content = ev.formattedMessage
    ? JSON.parse(ev.formattedMessage)
    : ev.unsignedChat
      ? JSON.parse(ev.unsignedContent)
      : ev.plainMessage
  const jsonMsg = JSON.parse(packet.message)
  if (ev.senderName === client.username) return
  client.chat(JSON.stringify(content))
});
```

Set `auth` to `offline` if the server is in offline mode. If `auth` is set to `microsoft`, you will be prompted to login to microsoft.com with a code in your browser. After signing in on your browser, the client will automatically obtain and cache authentication tokens (under your specified username) so you don't have to sign-in again.

To switch the account, update the supplied username. By default, cached tokens will be stored in your user's .minecraft folder, or if profilesFolder is specified, they'll instead be stored there. For more information on bot options see the [API doc](./API.md).

Note: SRV records will only be looked up if the port is unspecified or set to 25565 and if the `host` is a valid non-local domain name.

### Client example joining a Realm

Example to connect to a Realm that the authenticating account is owner of or has been invited to:

```js
const mc = require('minecraft-protocol');
const client = mc.createClient({
  realms: {
    pickRealm: (realms) => realms[0] // Function which recieves an array of joined/owned Realms and must return a single Realm. Can be async
  },
  auth: 'microsoft'
})
```

### Hello World server example

For a more up to date example, see examples/server/server.js.

```js
const mc = require('minecraft-protocol')
const nbt = require('prismarine-nbt')
const server = mc.createServer({
  'online-mode': true,   // optional
  encryption: true,      // optional
  host: '0.0.0.0',       // optional
  port: 25565,           // optional
  version: '1.18'
})
const mcData = require('minecraft-data')(server.version)

function chatText (text) {
  return mcData.supportFeature('chatPacketsUseNbtComponents')
    ? nbt.comp({ text: nbt.string(text) })
    : JSON.stringify({ text })
}

server.on('playerJoin', function(client) {
  const loginPacket = mcData.loginPacket

  client.write('login', {
    ...loginPacket,
    enforceSecureChat: false,
    entityId: client.id,
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  })

  client.write('position', {
    x: 0,
    y: 255,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  })

  const message = {
    translate: 'chat.type.announcement',
    with: [
      'Server',
      'Hello, world!'
    ]
  }
  if (mcData.supportFeature('signedChat')) {
    client.write('player_chat', {
      plainMessage: message,
      signedChatContent: '',
      unsignedChatContent: chatText(message),
      type: mcData.supportFeature('chatTypeIsHolder') ? { chatType: 1 } : 0,
      senderUuid: 'd3527a0b-bc03-45d5-a878-2aafdd8c8a43', // random
      senderName: JSON.stringify({ text: 'me' }),
      senderTeam: undefined,
      timestamp: Date.now(),
      salt: 0n,
      signature: mcData.supportFeature('useChatSessions') ? undefined : Buffer.alloc(0),
      previousMessages: [],
      filterType: 0,
      networkName: JSON.stringify({ text: 'me' })
    })
  } else {
    client.write('chat', { message: JSON.stringify({ text: message }), position: 0, sender: 'me' })
  }
})
```

## Testing

* Ensure your system has the `java` executable in `PATH`.
* `MC_SERVER_JAR_DIR=some/path/to/store/minecraft/server/ MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

## Debugging

You can enable some protocol debugging output using `DEBUG` environment variable:

```bash
DEBUG="minecraft-protocol" node [...]
```

On Windows:
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
