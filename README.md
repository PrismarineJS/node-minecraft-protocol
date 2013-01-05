# minecraft protocol

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Supports Minecraft version 1.4.7pre
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

## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=username MC_EMAIL=email@example.com MC_PASSWORD=password npm test`

### Test Coverage

```
  client
    ✓ pings the server (6164ms)
    ✓ connects successfully - online mode (2527ms)
    ✓ connects successfully - offline mode (1902ms)
    ✓ gets kicked when no credentials supplied in online mode (3720ms)
    ✓ does not crash for 10000ms (11731ms)
  mc-server
    ✓ starts listening and shuts down cleanly 
    ✓ kicks clients that do not log in (103ms)
    ✓ kicks clients that do not send keepalive packets (104ms)
    ✓ responds to ping requests 
    ✓ clients can log in and chat (43ms)
    ✓ gives correct reason for kicking clients when shutting down 


  11 tests complete (45 seconds)
```
