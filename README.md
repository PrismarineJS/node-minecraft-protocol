# minecraft protocol [![NPM version](https://badge.fury.io/js/minecraft-protocol.png)](http://badge.fury.io/js/minecraft-protocol)

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft version 1.6.4
 * Parses all packets and emits events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * Client
   - Authenticating and logging in
   - Encryption on and encryption off
   - Both online and offline mode
   - Respond to keep-alive packets.
   - Ping a server for status
 * Server
   - Offline mode
   - Encryption and online mode
   - Handshake
   - Keep-alive checking
   - Ping status
 * Robust test coverage. See Test Coverage section below.
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

## Projects Using node-minecraft-protocol

 * [mineflayer](https://github.com/superjoe30/mineflayer/) - create minecraft
   bots with a stable, high level API.
 * [mcserve](https://github.com/superjoe30/mcserve) - runs and monitors your
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
client.on(0x03, function(packet) {
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
  client.write(0x01, {
    entityId: client.id,
    levelType: 'default',
    gameMode: 0,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers
  });
  client.write(0x0d, {
    x: 0,
    y: 1.62,
    stance: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    onGround: true
  });
  var msg = { translate: 'chat.type.announcement', using [
    'Server',
    'Hello, ' + client.username
  ]};
  client.write(0x03, { message: JSON.stringify(msg) });
});
```

## Installation

### Linux

`npm install minecraft-protocol`

### Windows

 * Follow the Windows instructions from [Obvious/ursa](https://github.com/Obvious/ursa)
 * `npm install minecraft-protocol`

## Documentation

### mc.ping(options, callback)

`callback(err, pingResults)`

`pingResults`:

 * `prefix`
 * `protocol`
 * `version`
 * `motd`
 * `playerCount`
 * `maxPlayers`

### mc.createServer(options)

Returns a `Server` instance and starts listening.

### Server

#### server.onlineModeExceptions

This is a plain old JavaScript object. Add a key with the username you want to
be exempt from online mode or offline mode (whatever mode the server is in).

Make sure the entries in this object are all lower case.

#### server.maxPlayers

### Not Immediately Obvious Data Type Formats

#### entityMetadata

Value looks like this:

```js
[
  {type: 'slot', value: slot, key: 3},
  {type: 'int', value: value, key: 4},
  ...
]
```

Where the key is the numeric metadata key and the value is the value of the 
correct data type.

#### propertyArray

Included inside *Entity Properties (0x2C)* packets.

```js
[
  { key: 'generic.maxHealth', value: 20, elementList: [] },
  { key: 'generic.movementSpeed', value: 0.25, elementList: [] }
]
```

Where elementList is an array with the following structure:

```js
[
  { uuid: [ 123, 456, 78, 90 ], amount: 0.5, operation: 1 },
  ...
]
```

## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

### Test Coverage

```
  packets
    ✓ 0x00 
    ✓ 0x01 
    ✓ 0x02 
    ✓ 0x03 
    ✓ 0x04 
    ✓ 0x05 
    ✓ 0x06 
    ✓ 0x07 
    ✓ 0x08 
    ✓ 0x09 
    ✓ 0x0a 
    ✓ 0x0b 
    ✓ 0x0c 
    ✓ 0x0d 
    ✓ 0x0e 
    ✓ 0x0f 
    ✓ 0x10 
    ✓ 0x11 
    ✓ 0x12 
    ✓ 0x13 
    ✓ 0x14 
    ✓ 0x16 
    ✓ 0x17 
    ✓ 0x18 
    ✓ 0x19 
    ✓ 0x1a 
    ✓ 0x1c 
    ✓ 0x1d 
    ✓ 0x1e 
    ✓ 0x1f 
    ✓ 0x20 
    ✓ 0x21 
    ✓ 0x22 
    ✓ 0x23 
    ✓ 0x26 
    ✓ 0x27 
    ✓ 0x28 
    ✓ 0x29 
    ✓ 0x2a 
    ✓ 0x2b 
    ✓ 0x33 
    ✓ 0x34 
    ✓ 0x35 
    ✓ 0x36 
    ✓ 0x37 
    ✓ 0x38 
    ✓ 0x3c 
    ✓ 0x3d 
    ✓ 0x3e 
    ✓ 0x3f 
    ✓ 0x46 
    ✓ 0x47 
    ✓ 0x64 
    ✓ 0x65 
    ✓ 0x66 
    ✓ 0x67 
    ✓ 0x68 
    ✓ 0x69 
    ✓ 0x6a 
    ✓ 0x6b 
    ✓ 0x6c 
    ✓ 0x82 
    ✓ 0x83 
    ✓ 0x84 
    ✓ 0xc8 
    ✓ 0xc9 
    ✓ 0xca 
    ✓ 0xcb 
    ✓ 0xcc 
    ✓ 0xcd 
    ✓ 0xce 
    ✓ 0xcf 
    ✓ 0xd0 
    ✓ 0xd1 
    ✓ 0xfa 
    ✓ 0xfc 
    ✓ 0xfd 
    ✓ 0xfe 
    ✓ 0xff 

  client
    ✓ pings the server (6653ms)
    ✓ connects successfully - online mode (4041ms)
    ✓ connects successfully - offline mode (2663ms)
    ✓ gets kicked when no credentials supplied in online mode (4678ms)
    ✓ does not crash for 10000ms (12492ms)
...............
  mc-server
    ✓ starts listening and shuts down cleanly (44ms)
    ✓ kicks clients that do not log in (149ms)
    ✓ kicks clients that do not send keepalive packets (153ms)
    ✓ responds to ping requests 
    ✓ clients can log in and chat (71ms)
    ✓ kicks clients when invalid credentials (263ms)
    ✓ gives correct reason for kicking clients when shutting down (40ms)


  91 tests complete (50 seconds)
```

# Debugging

You can enable some protocol debugging output using `NODE_DEBUG` environment variable:

```bash
NODE_DEBUG="minecraft-protocol" node [...]
```

## History

### 0.11.6

 * Updated protocol version to support 1.6.4 (thanks [Matt Bell](https://github.com/mappum))

### 0.11.5

 * Fix handling of some conditional fields (thanks [Florian Wesch](https://github.com/dividuum))

### 0.11.4

 * Chat packet string max length fix (thanks [Robin Lambertz](https://github.com/roblabla))

### 0.11.3

 * packet 0x2c: packet writing fixed, UUID format simplified, tests updated

### 0.11.2

 * 1.6.2 support fixes: updated 0x2c packets to include `elementList` and added 0x85 *Tile Editor Open* packets

### 0.11.1

 * support minecraft protocol 1.6.2 / protocol version 74 (thanks [Matt Bell](https://github.com/mappum))

### 0.11.0

 * support minecraft protocol 1.6.1 / protocol version 73 (thanks [Matt Bell](https://github.com/mappum))
   * *note:* chat packets have a new format (see [the examples](https://github.com/superjoe30/node-minecraft-protocol/tree/master/examples) for how to upgrade).

### 0.10.1

 * support minecraft protocol 1.5.2 / protocol version 61

### 0.10.0

 * Added SRV record support when connecting to a server (thanks [Matt Stith](https://github.com/stith))
 * 0x66: `shift` renamed to `mode` and changed from bool to byte

### 0.9.0

 * 0xce: create changed from bool to byte (thanks [Robin Lambertz](https://github.com/roblabla))

### 0.8.1

 * fix buffer length checking bug in readSlot() (thanks [Xabier de Zuazo](https://github.com/zuazo))
 * fix C2 calculation bug (fixed #35) (thanks [Xabier de Zuazo](https://github.com/zuazo))
 * fix oob Buffer at readEntityMetadata (fixed #40) (thanks [Xabier de Zuazo](https://github.com/zuazo))

### 0.8.0

 * fix remaining bugs for 1.5.1 protocol (thanks [Xabier de Zuazo](https://github.com/zuazo))
 * writing packets is 6% faster (thanks [Matt Bell](https://github.com/mappum))

### 0.7.9

 * support minecraft protocol 1.5 / protocol version 60 (thanks [Matt Bell](https://github.com/mappum))

### 0.7.8

 * server: ability to change `motd` and `maxPlayers`
 * server: fix incorrect `playerCount`

### 0.7.7

 * server: fix crash when client disconnects quickly

### 0.7.6

 * onlineModeExceptions are all lowercase now. fixes security hole.

### 0.7.5

 * server: add `onlineModeExceptions`. When server is in:
   - online mode: these usernames are exempt from online mode.
   - offline mode: these usernames must authenticate.

### 0.7.4

 * server: online mode: don't log in client until username verification

### 0.7.3

 * revert removing socket delays to reduce latency as it was causing
   errors and test failures.
 * server: Client now emits more predictable 'end' events.

### 0.7.2

 * fix objectData writer. This fixes sending an 0x17 packet.

### 0.7.1

 * remove socket delays to reduce latency. (thanks [Matt Bell](https://github.com/mappum))

### 0.7.0

 * `createServer`: rename `encryption-enabled` option to `encryption` to stay
   consistent with the examples. (thanks [Robin Lambertz](https://github.com/roblabla))
 * `createClient`: don't require both `email` and `username`.
   - The `username` and `password` arguments are used to authenticate with the
     official minecraft servers and determine the case-correct username. If
     you have migrated your user account to a mojang login, `username` looks
     like an email address.
   - If you leave out the `password` argument, `username` is used to connect
     directly to the server. In this case you will get kicked if the server is
     in online mode.

### 0.6.7

Emit 'error' event instead of crashing when other computers abuse the
minecraft protocol.

Big thanks to [Robin Lambertz](https://github.com/roblabla) for this release.

### 0.6.6

 * ping: fix calling callback twice when server sends kick
 * server: send a kick packet when kicking clients. (thanks [Robin Lambertz](https://github.com/roblabla))
 * ping: include latency property (thanks [Jan Buschtöns](https://github.com/silvinci))

### 0.6.5

 * createServer: allow empty options
 * server: support online mode and encryption (thanks [Robin Lambertz](https://github.com/roblabla))

### 0.6.4

 * Allow minecraft username instead of mojang email. (thanks [Robin Lambertz](https://github.com/roblabla))

### 0.6.3

 * y values when only 1 byte are always unsigned

### 0.6.2

 * 0x0e: change face to unsigned byte

### 0.6.1

 * 0x0d: fix incorrectly swapped stance and y
