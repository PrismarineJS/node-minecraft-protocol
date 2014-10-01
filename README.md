# minecraft protocol [![NPM version](https://badge.fury.io/js/minecraft-protocol.png)](http://badge.fury.io/js/minecraft-protocol)

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft version 1.7.10
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

On Windows, first follow the Windows instructions from
[Obvious/ursa](https://github.com/Obvious/ursa)

## Documentation

### mc.ping(options, callback)

`callback(err, pingResults)`

`pingResults`:

#### Old version
 * `prefix`
 * `protocol`
 * `version`
 * `motd`
 * `playerCount`
 * `maxPlayers`

#### New version
 * `description`
 * `players`
    * `max`
    * `online`
    * `sample`
       * `id`
       * `name`
 * `version`
    * `name`
    * `protocol`
 * `favicon`
 * `latency`

### mc.createServer(options)

Returns a `Server` instance and starts listening.

### Server

#### server.onlineModeExceptions

This is a plain old JavaScript object. Add a key with the username you want to
be exempt from online mode or offline mode (whatever mode the server is in).

Make sure the entries in this object are all lower case.

#### server.clients

Javascript object mapping a `Client` from a clientId.

### server.playerCount

The amount of players currently present on the server.

#### server.maxPlayers

The maximum amount of players allowed on the server.

#### server.motd

The motd that is sent to the player when he is pinging the server

#### server.favicon

A base64 data string representing the favicon that will appear next to the server
on the mojang client's multiplayer list.

### mc.createClient(option)

Returns a `Client` instance and perform login

### Client

#### client.state

The internal state that is used to figure out which protocol state we are in during
packet parsing. This is one of the protocol.states.

#### client.isServer

True if this is a connection going from the server to the client,
False if it is a connection from client to server.


#### client.socket

Returns the internal nodejs Socket used to communicate with this client.

#### client.uuid

A string representation of the client's UUID. Note that UUIDs are unique for
each players, while playerNames, as of 1.7.7, are not unique and can change.

### client.username

The user's username.

### client.session

The user's session, as returned by the Yggdrasil system. 

### Not Immediately Obvious Data Type Formats

Note : almost all data formats can be understood by looking at the packet 
structure in lib/protocol.js

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

## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

### Test Coverage

```
  packets
    √ handshaking,ServerBound,0x00
    √ status,ServerBound,0x00
    √ status,ServerBound,0x01
    √ status,ClientBound,0x00
    √ status,ClientBound,0x01
    √ login,ServerBound,0x00
    √ login,ServerBound,0x01
    √ login,ClientBound,0x00
    √ login,ClientBound,0x01
    √ login,ClientBound,0x02
    √ play,ServerBound,0x00
    √ play,ServerBound,0x01
    √ play,ServerBound,0x02
    √ play,ServerBound,0x03
    √ play,ServerBound,0x04
    √ play,ServerBound,0x05
    √ play,ServerBound,0x06
    √ play,ServerBound,0x07
    √ play,ServerBound,0x08
    √ play,ServerBound,0x09
    √ play,ServerBound,0x0a
    √ play,ServerBound,0x0b
    √ play,ServerBound,0x0c
    √ play,ServerBound,0x0d
    √ play,ServerBound,0x0e
    √ play,ServerBound,0x0f
    √ play,ServerBound,0x10
    √ play,ServerBound,0x11
    √ play,ServerBound,0x12
    √ play,ServerBound,0x13
    √ play,ServerBound,0x14
    √ play,ServerBound,0x15
    √ play,ServerBound,0x16
    √ play,ServerBound,0x17
    √ play,ClientBound,0x00
    √ play,ClientBound,0x01
    √ play,ClientBound,0x02
    √ play,ClientBound,0x03
    √ play,ClientBound,0x04
    √ play,ClientBound,0x05
    √ play,ClientBound,0x06
    √ play,ClientBound,0x07
    √ play,ClientBound,0x08
    √ play,ClientBound,0x09
    √ play,ClientBound,0x0a
    √ play,ClientBound,0x0b
    √ play,ClientBound,0x0c
    √ play,ClientBound,0x0d
    √ play,ClientBound,0x0e
    √ play,ClientBound,0x0f
    √ play,ClientBound,0x10
    √ play,ClientBound,0x11
    √ play,ClientBound,0x12
    √ play,ClientBound,0x13
    √ play,ClientBound,0x14
    √ play,ClientBound,0x15
    √ play,ClientBound,0x16
    √ play,ClientBound,0x17
    √ play,ClientBound,0x18
    √ play,ClientBound,0x19
    √ play,ClientBound,0x1a
    √ play,ClientBound,0x1b
    √ play,ClientBound,0x1c
    √ play,ClientBound,0x1d
    √ play,ClientBound,0x1e
    √ play,ClientBound,0x1f
    √ play,ClientBound,0x20
    √ play,ClientBound,0x21
    √ play,ClientBound,0x22
    √ play,ClientBound,0x23
    √ play,ClientBound,0x24
    √ play,ClientBound,0x25
    √ play,ClientBound,0x26
    √ play,ClientBound,0x27
    √ play,ClientBound,0x28
    √ play,ClientBound,0x29
    √ play,ClientBound,0x2a
    √ play,ClientBound,0x2b
    √ play,ClientBound,0x2c
    √ play,ClientBound,0x2d
    √ play,ClientBound,0x2e
    √ play,ClientBound,0x2f
    √ play,ClientBound,0x30
    √ play,ClientBound,0x31
    √ play,ClientBound,0x32
    √ play,ClientBound,0x33
    √ play,ClientBound,0x34
    √ play,ClientBound,0x35
    √ play,ClientBound,0x36
    √ play,ClientBound,0x37
    √ play,ClientBound,0x38
    √ play,ClientBound,0x39
    √ play,ClientBound,0x3a
    √ play,ClientBound,0x3b
    √ play,ClientBound,0x3c
    √ play,ClientBound,0x3d
    √ play,ClientBound,0x3e
    √ play,ClientBound,0x3f
    √ play,ClientBound,0x40

  client
    √ pings the server (32734ms)
    √ connects successfully - online mode (23367ms)
    √ connects successfully - offline mode (10261ms)
    √ gets kicked when no credentials supplied in online mode (18400ms)
    √ does not crash for 10000ms (24780ms)

  mc-server
    √ starts listening and shuts down cleanly (73ms)
    √ kicks clients that do not log in (295ms)
    √ kicks clients that do not send keepalive packets (266ms)
    √ responds to ping requests (168ms)
    √ clients can log in and chat (158ms)
    √ kicks clients when invalid credentials (680ms)
    √ gives correct reason for kicking clients when shutting down (123ms)


  111 tests complete (3 minutes)
```

# Debugging

You can enable some protocol debugging output using `NODE_DEBUG` environment variable:

```bash
NODE_DEBUG="minecraft-protocol" node [...]
```

## History
### 0.12.2

 * Updated protocol version to support 1.7.10
 * Some bug fixes in parser (thanks [Luke Young](https://github.com/innoying))
 * 'raw' event to catch all raw buffers (thanks [deathcap](https://github.com/deathcap))
 * Misc bug fixes

### 0.12.1

 * Updated protocol version to support 1.7.6

### 0.12.0
 
 * Updated protocol version to support 1.7.2
 * Overhaul the serializer backend to be more general-purpose and future-proof.
 * Support listening packets by name (thanks [deathcap](https://github.com/deathcap))
 * Support reading/writing a raw buffer to the socket.

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
   * *note:* chat packets have a new format (see [the examples](https://github.com/andrewrk/node-minecraft-protocol/tree/master/examples) for how to upgrade).

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
