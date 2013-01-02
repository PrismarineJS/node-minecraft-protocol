# minecraft protocol

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

 * Parses all packets and emits `packet` events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * Supports authenticating and logging in.
   - Supports encryption enabled
   - Supports encryption disabled (TODO #2)
   - Supports online mode
   - Supports offline mode (TODO #1)
 * Send keep-alive packet at the correct interval.
 * Reasonable amount of test coverage (TODO #3)
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

## Minecraft Compatibility

Supports Minecraft version 1.4.6

## Try it out so far

`MC_EMAIL=you@example.com MC_PASSWORD=your_pass node test.js`
