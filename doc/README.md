# Documentation

## mc.ping(options, callback)

`callback(err, pingResults)`

`pingResults`:

## Old version
 * `prefix`
 * `protocol`
 * `version`
 * `motd`
 * `playerCount`
 * `maxPlayers`

## New version
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

## mc.createServer(options)

Returns a `Server` instance and starts listening. All clients will be
automatically logged in and validated against mojang's auth.

## Server

### server.onlineModeExceptions

This is a plain old JavaScript object. Add a key with the username you want to
be exempt from online mode or offline mode (whatever mode the server is in).

Make sure the entries in this object are all lower case.

### server.clients

Javascript object mapping a `Client` from a clientId.

### server.playerCount

The amount of players currently present on the server.

### server.maxPlayers

The maximum amount of players allowed on the server.

### server.motd

The motd that is sent to the player when he is pinging the server

### server.favicon

A base64 data string representing the favicon that will appear next to the server
on the mojang client's multiplayer list.

### `connection` event

Called when a client connects, but before any login has happened. Takes a
`Client` parameter.

### `login` event

Called when a client is logged in against server. Takes a `Client` parameter.

## mc.createClient(options)

Returns a `Client` instance and perform login.

`options` is an object containing the properties :
 * username
 * port : default to 25565
 * password : can be omitted (if the tokens are also omitted then it tries to connect in offline mode)
 * host : default to localhost
 * clientToken : generated if a password is given
 * accessToken : generated if a password is given
 * keepAlive : send keep alive packets : default to true
 * version : 1.8 or 1.9

## Client

### client.state

The internal state that is used to figure out which protocol state we are in during
packet parsing. This is one of the protocol.states.

### client.isServer

True if this is a connection going from the server to the client,
False if it is a connection from client to server.


### client.socket

Returns the internal nodejs Socket used to communicate with this client.

### client.uuid

A string representation of the client's UUID. Note that UUIDs are unique for
each players, while playerNames, as of 1.7.7, are not unique and can change.

### client.username

The user's username.

### client.session

The user's session, as returned by the Yggdrasil system. 

### `packet` event

Called with every packet parsed. Takes two params, the JSON data we parsed,
and the packet metadata (name, state)

### `raw` event

Called with every packet, but as a buffer. Takes two params, the buffer
and the packet metadata (name, state)

### `state` event

Called when the protocol changes state. Takes the new state and old state as
parameters.

### per-packet events

Check out the [minecraft-data docs](https://prismarinejs.github.io/minecraft-data/?v=1.8&d=protocol) to know the event names and data field names.

## Not Immediately Obvious Data Type Formats

Note : almost all data formats can be understood by looking at the packet 
structure in lib/protocol.js

## entityMetadata

Value looks like this:

```js
[
  {type: 1, value: 2, key: 3},
  {type: 2, value: 3, key: 4},
  ...
]
```

Where the key is the numeric metadata key and the value is the value of the
correct data type. You can figure out the types [here](http://wiki.vg/Entities#Entity_Metadata_Format)
