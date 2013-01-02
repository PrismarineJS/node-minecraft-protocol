# minecraft protocol

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Parses all packets and emits `packet` events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * Supports authenticating and logging in.
   - Supports encryption
   - Supports online mode
   - Supports offline mode
 * Send keep-alive packet at the correct interval.
 * Reasonable amount of test coverage (TODO #3)
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

## Minecraft Compatibility

Supports Minecraft version 1.4.6

## Usage

### Echo example

Listen for chat messages and echo them back.

```js
var mc = require('minecraft-protocol');
var client = mc.createClient({
  host: "localhost", // optional
  port: 25565,       // optional
  username: "player",
  email: "email@example.com", // email and password are required only for
  password: "12345678",       // encrypted and online servers
});
client.on('packet', function(packet) {
  if (packet.id !== 0x03) return;
  if (packet.message.indexOf(client.session.username) !== -1) return;
  client.writePacket(0x03, {
    message: packet.message,
  });
});
```

## Testing

* Ensure your system has the `java` executable in `PATH`.
* Download the appropriate version of `minecraft_server.jar`.
* `MC_SERVER_JAR=path/to/minecraft_server.jar MC_USERNAME=username MC_EMAIL=email@example.com MC_PASSWORD=password npm test`

## Updating to a newer protocol version

In most cases you should only have to do the following:

1. In `packets.json`:
 * Update `protocolVersion` to the correct number.
 * Edit the data structure to reflect the new packet layout.
2. Update the "Minecraft Compatibility" section above in this README.
3. Run the test suite to make sure everything still works. See "Testing" above.
