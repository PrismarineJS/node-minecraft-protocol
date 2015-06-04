# minecraft protocol
[![NPM version](https://badge.fury.io/js/minecraft-protocol.svg)](http://badge.fury.io/js/minecraft-protocol) [![Build Status](https://circleci.com/gh/PrismarineJS/node-minecraft-protocol.svg?style=shield)](https://circleci.com/gh/PrismarineJS/node-minecraft-protocol) [![Join the chat at https://gitter.im/PrismarineJS/node-minecraft-protocol](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/PrismarineJS/node-minecraft-protocol?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)



Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft version 1.8.1
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
 * Robust test coverage. See Test Coverage section below.
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

## Projects Using node-minecraft-protocol

 * [mineflayer](https://github.com/andrewrk/mineflayer/) - create minecraft
   bots with a stable, high level API.
 * [mcserve](https://github.com/andrewrk/mcserve) - runs and monitors your
   minecraft server, provides real-time web interface, allow your users to
   create bots.

## Usage

### Echo client example

```js
var mc = require('minecraft-protocol');
var client = mc.createClient({
  host: "localhost",   // optional
  port: 25565,         // optional
  username: "email@example.com",
  password: "12345678",
});
client.on('chat', function(packet) {
  // Listen for chat messages and echo them back.
  var jsonMsg = JSON.parse(packet.message);
  if (jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
    var username = jsonMsg.using[0];
    var msg = jsonMsg.using[1];
    if (username === client.username) return;
    client.write(0x03, {
      message: msg
    });
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
});
server.on('login', function(client) {
  client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers
  });
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    onGround: true
  });
  var msg = { translate: 'chat.type.announcement', using: [
    'Server',
    'Hello, ' + client.username
  ]};
  client.write(0x03, { message: JSON.stringify(msg) });
});
```

## Installation

`npm install minecraft-protocol`

URSA, an optional dependency, should improve login times
for servers. However, it can be somewhat complicated to install.

Follow the instructions from
[Obvious/ursa](https://github.com/Obvious/ursa)

## Documentation

See [doc](doc/README.md)


## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

### Test Coverage

```

  packets
    ✓ handshaking,ServerBound,0x00
    ✓ status,ServerBound,0x00
    ✓ status,ServerBound,0x01
    ✓ status,ClientBound,0x00
    ✓ status,ClientBound,0x01
    ✓ login,ServerBound,0x00
    ✓ login,ServerBound,0x01
    ✓ login,ClientBound,0x00
    ✓ login,ClientBound,0x01
    ✓ login,ClientBound,0x02
    ✓ login,ClientBound,0x03
    ✓ play,ServerBound,0x00
    ✓ play,ServerBound,0x01
    ✓ play,ServerBound,0x02
    ✓ play,ServerBound,0x03
    ✓ play,ServerBound,0x04
    ✓ play,ServerBound,0x05
    ✓ play,ServerBound,0x06
    ✓ play,ServerBound,0x07
    ✓ play,ServerBound,0x08
    ✓ play,ServerBound,0x09
    ✓ play,ServerBound,0x0a
    ✓ play,ServerBound,0x0b
    ✓ play,ServerBound,0x0c
    ✓ play,ServerBound,0x0d
    ✓ play,ServerBound,0x0e
    ✓ play,ServerBound,0x0f
    ✓ play,ServerBound,0x10
    ✓ play,ServerBound,0x11
    ✓ play,ServerBound,0x12
    ✓ play,ServerBound,0x13
    ✓ play,ServerBound,0x14
    ✓ play,ServerBound,0x15
    ✓ play,ServerBound,0x16
    ✓ play,ServerBound,0x17
    ✓ play,ServerBound,0x18
    ✓ play,ServerBound,0x19
    ✓ play,ClientBound,0x00
    ✓ play,ClientBound,0x01
    ✓ play,ClientBound,0x02
    ✓ play,ClientBound,0x03
    ✓ play,ClientBound,0x04
    ✓ play,ClientBound,0x05
    ✓ play,ClientBound,0x06
    ✓ play,ClientBound,0x07
    ✓ play,ClientBound,0x08
    ✓ play,ClientBound,0x09
    ✓ play,ClientBound,0x0a
    ✓ play,ClientBound,0x0b
    ✓ play,ClientBound,0x0c
    ✓ play,ClientBound,0x0d
    ✓ play,ClientBound,0x0e
    ✓ play,ClientBound,0x0f
    ✓ play,ClientBound,0x10
    ✓ play,ClientBound,0x11
    ✓ play,ClientBound,0x12
    ✓ play,ClientBound,0x13
    ✓ play,ClientBound,0x14
    ✓ play,ClientBound,0x15
    ✓ play,ClientBound,0x16
    ✓ play,ClientBound,0x17
    ✓ play,ClientBound,0x18
    ✓ play,ClientBound,0x19
    ✓ play,ClientBound,0x1a
    ✓ play,ClientBound,0x1b
    ✓ play,ClientBound,0x1c
    ✓ play,ClientBound,0x1d
    ✓ play,ClientBound,0x1e
    ✓ play,ClientBound,0x1f
    ✓ play,ClientBound,0x20
    ✓ play,ClientBound,0x21
    ✓ play,ClientBound,0x22
    ✓ play,ClientBound,0x23
    ✓ play,ClientBound,0x24
    ✓ play,ClientBound,0x25
    ✓ play,ClientBound,0x26
    ✓ play,ClientBound,0x27
    ✓ play,ClientBound,0x28
    ✓ play,ClientBound,0x29
    ✓ play,ClientBound,0x2a
    ✓ play,ClientBound,0x2b
    ✓ play,ClientBound,0x2c
    ✓ play,ClientBound,0x2d
    ✓ play,ClientBound,0x2e
    ✓ play,ClientBound,0x2f
    ✓ play,ClientBound,0x30
    ✓ play,ClientBound,0x31
    ✓ play,ClientBound,0x32
    ✓ play,ClientBound,0x33
    ✓ play,ClientBound,0x34
    ✓ play,ClientBound,0x35
    ✓ play,ClientBound,0x36
    ✓ play,ClientBound,0x37
    ✓ play,ClientBound,0x38
    ✓ play,ClientBound,0x39
    ✓ play,ClientBound,0x3a
    ✓ play,ClientBound,0x3b
    ✓ play,ClientBound,0x3c
    ✓ play,ClientBound,0x3d
    ✓ play,ClientBound,0x3e
    ✓ play,ClientBound,0x3f
    ✓ play,ClientBound,0x40
    ✓ play,ClientBound,0x41
    ✓ play,ClientBound,0x42
    ✓ play,ClientBound,0x43
    ✓ play,ClientBound,0x44
    ✓ play,ClientBound,0x45
    ✓ play,ClientBound,0x46
    ✓ play,ClientBound,0x47
    ✓ play,ClientBound,0x48
    ✓ play,ClientBound,0x49

  client
    ✓ pings the server (65754ms)
    ✓ connects successfully - online mode (STUBBED)
    ✓ connects successfully - offline mode (STUBBED)
    ✓ gets kicked when no credentials supplied in online mode (67167ms)
    ✓ does not crash for 10000ms (69597ms)

  mc-server
    ✓ starts listening and shuts down cleanly
    ✓ kicks clients that do not log in (133ms)
    ✓ kicks clients that do not send keepalive packets (122ms)
    ✓ responds to ping requests
    ✓ clients can log in and chat (39ms)
    ✓ kicks clients when invalid credentials (8430ms)
    ✓ gives correct reason for kicking clients when shutting down (42ms)


  123 tests complete (4 minutes)
```

## Debugging

You can enable some protocol debugging output using `NODE_DEBUG` environment variable:

```bash
NODE_DEBUG="minecraft-protocol" node [...]
```

## History

See [history](HISTORY.md)
