# minecraft protocol

This project simply provides protocol support. You'll want to use a higher
level library to write bots.

Hopefully eventually we can merge 
[mineflayer](https://github.com/superjoe30/mineflayer) with this project.

## Try it out so far

```
$ MC_EMAIL=you@example.com MC_PASSWORD=your_pass node test.js
logging in to minecraft.net
logged in as user_name
connect
enc key request
write enc key response
confirmation enc key response
writing 205 packet with encryption
login request { id: 1,
  entityId: 839,
  levelType: 'default',
  gameMode: 0,
  dimension: 0,
  difficulty: 1,
  _notUsed1: 0,
  maxPlayers: 20 }

assert.js:102
  throw new assert.AssertionError({
        ^
AssertionError: Unrecognized packetId: 6
```
