# minecraft protocol

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft version 1.4.7
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
   - [TODO](https://github.com/superjoe30/node-minecraft-protocol/issues/13) - 
     Encryption and online mode
   - Handshake
   - Keep-alive checking
   - Ping status
 * Robust test coverage. See Test Coverage section below.
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

This package aims to be a low-level interface to the Minecraft protocol and
no more. If you want a higher-level API with which to write bots, see
[mineflayer](https://github.com/superjoe30/mineflayer/)

## Usage

### Echo client example

```js
var mc = require('minecraft-protocol');
var client = mc.createClient({
  host: "localhost", // optional
  port: 25565,       // optional
  username: "player",
  email: "email@example.com", // email and password are required only for
  password: "12345678",       // online-mode=true servers
});
client.on(0x03, function(packet) {
  // Listen for chat messages and echo them back.
  if (packet.message.indexOf(client.session.username) !== -1) return;
  client.write(0x03, {
    message: packet.message,
  });
});
```

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
  client.write(0x03, { message: 'Hello, ' + client.username });
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

## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=username MC_EMAIL=email@example.com MC_PASSWORD=password npm test`

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
    ✓ 0xfa 
    ✓ 0xfc 
    ✓ 0xfd 
    ✓ 0xfe 
    ✓ 0xff 

  client
    ✓ pings the server
    ✓ connects successfully - online mode
    ✓ connects successfully - offline mode
    ✓ gets kicked when no credentials supplied in online mode
    ✓ does not crash for 10000ms

  mc-server
    ✓ starts listening and shuts down cleanly 
    ✓ kicks clients that do not log in
    ✓ kicks clients that do not send keepalive packets
    ✓ responds to ping requests 
    ✓ clients can log in and chat
    ✓ gives correct reason for kicking clients when shutting down 


  85 tests complete
```

## History

### 0.6.4

 * Allow minecraft username instead of mojang email. (thanks roblabla)

### 0.6.3

 * y values when only 1 byte are always unsigned

### 0.6.2

 * 0x0e: change face to unsigned byte

### 0.6.1

 * 0x0d: fix incorrectly swapped stance and y
