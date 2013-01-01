# minecraft protocol

Parse minecraft
This project simply provides protocol support. You'll want to use a higher
level library to write bots.

Hopefully eventually we can merge 
[mineflayer](https://github.com/superjoe30/mineflayer) with this project.

## Features

 * (TODO #8) Parse all packets and emit `packet` events with packet fields as JavaScript
   objects.
 * Send a packet by supplying fields as a JavaScript object.
 * (TODO #9) Send keep-alive packet at the correct interval.
 * Supports encryption, no encryption (TODO #2), online, and offline (TODO #1) modes.
 * Reasonable amount of test coverage (TODO #3)
 * Optimized for rapidly staying up to date with Minecraft protocol updates.

## Minecraft Compatibility

Supports Minecraft version 1.4.6

## Try it out so far

`MC_EMAIL=you@example.com MC_PASSWORD=your_pass node test.js`
