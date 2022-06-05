# Documentation

## mc.createServer(options)

Returns a `Server` instance and starts listening. All clients will be
automatically logged in and validated against mojang's auth.

`options` is an object containing the properties :
 * port : default to 25565
 * host : default to undefined which means listen to all available ipv4 and ipv6 adresses
 (see https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback for details)
 * kickTimeout : default to `10*1000` (10s), kick client that doesn't answer to keepalive after that time
 * checkTimeoutInterval : default to `4*1000` (4s), send keepalive packet at that period
 * online-mode : default to true
 * beforePing : allow customisation of the answer to ping the server does. 
 It takes a function with argument response and client, response is the default json response, and client is client who sent a ping.
 It can take as third argument a callback. If the callback is passed, the function should pass its result to the callback, if not it should return.
 If the result is `false` instead of a response object then the connection is terminated and no ping is returned to the client.
 * beforeLogin : allow customisation of client before the `success` packet is sent.
 It takes a function with argument client and should be synchronous for the server to wait for completion before continuing execution.
 * motd : default to "A Minecraft server"
 * motdMsg : A json object of the chat message to use instead of `motd`. Can be build using [prismarine-chat](https://github.com/PrismarineJS/prismarine-chat) and calling .toJSON(). Not used with legacy pings.
 * maxPlayers : default to 20
 * keepAlive : send keep alive packets : default to true
 * version : the version of the server, defaults to the latest version. Set version to `false` to enable dynamic cross version support.
 * fallbackVersion (optional) : the version that should be used as a fallback, if the client version isn't supported, only works with dynamic cross version support.
 * favicon (optional) : the favicon to set, base64 encoded
 * customPackets (optional) : an object index by version/state/direction/name, see client_custom_packet for an example
 * errorHandler : A way to override the default error handler for client errors. A function that takes a Client and an error.
 The default kicks the client.
 * hideErrors : do not display errors, default to false
 * agent : a http agent that can be used to set proxy settings for yggdrasil authentication confirmation (see proxy-agent on npm)
 * validateChannelProtocol (optional) : whether or not to enable protocol validation for custom protocols using plugin channels for the connected clients. Defaults to true

## mc.Server(version,[customPackets])

Create a server instance for `version` of minecraft.

### server.writeToClients(clients, name, params)

Write a packet to all `clients` but encode it only once.

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

### `listening` event

Called when the server is listening for connections. This means that the server is ready to accept incoming connections.

### `close` event

Called when the server is no longer listening to incoming connections.


## mc.createClient(options)

Returns a `Client` instance and perform login.

`options` is an object containing the properties :
 * username
 * port : default to 25565
 * auth : the type of account to use, either `microsoft` or `mojang`. default to 'mojang'
 * password : can be omitted
   * (microsoft account) leave this blank to use device code auth. If you provide
   a password, we try to do username and password auth, but this does not always work.
   * (mojang account) If provided, we auth with the username and password. If this
   is blank, and `profilesFolder` is specified, we auth with the tokens there instead.
   If neither `password` or `profilesFolder` are specified, we connect in offline mode.
 * host : default to localhost
 * session : An object holding clientToken, accessToken and selectedProfile. Generated after logging in using username + password with mojang auth or after logging in using microsoft auth. `clientToken`, `accessToken` and `selectedProfile: {name: '<username>', id: '<selected profile uuid>'}` can be set inside of `session` when using createClient to login with a client and access Token instead of a password. `session` is also emitted by the `Client` instance with the event 'session' after successful authentication. 
   * clientToken : generated if a password is given or can be set when when using createClient
   * accessToken : generated if a password or microsoft account is given or can be set when using createBot
   * selectedProfile : generated if a password or microsoft account is given. Can be set as a object with property `name` and `id` that specifies the selected profile.
     * name : The selected profiles in game name needed for logging in with access and client Tokens.
     * id : The selected profiles uuid in short form (without `-`) needed for logging in with access and client Tokens.
 * authServer : auth server, default to https://authserver.mojang.com
 * sessionServer : session server, default to https://sessionserver.mojang.com
 * keepAlive : send keep alive packets : default to true
 * closeTimeout : end the connection after this delay in milliseconds if server doesn't answer to ping, default to `120*1000`
 * noPongTimeout : after the server opened the connection, wait for a default of `5*1000` after pinging and answers without the latency
 * checkTimeoutInterval : default to `30*1000` (30s), check if keepalive received at that period, disconnect otherwise.
 * version : 1.8 or 1.9 or false (to auto-negotiate): default to 1.8
 * customPackets (optional) : an object index by version/state/direction/name, see client_custom_packet for an example
 * hideErrors : do not display errors, default to false
 * skipValidation : do not try to validate given session, defaults to false
 * stream : a stream to use as connection
 * connect : a function taking the client as parameter and that should client.setSocket(socket) 
 and client.emit('connect') when appropriate (see the proxy examples for an example of use)
 * agent : a http agent that can be used to set proxy settings for yggdrasil authentication (see proxy-agent on npm) 
 * fakeHost : (optional) hostname to send to the server in the set_protocol packet
 * profilesFolder : optional
   * (mojang account) the path to the folder that contains your `launcher_profiles.json`. defaults to your minecraft folder if it exists, otherwise the local directory. set to `false` to disable managing profiles 
   * (microsoft account) the path to store authentication caches, defaults to .minecraft
 * onMsaCode(data) : (optional) callback called when signing in with a microsoft account
 with device code auth. `data` is an object documented [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code#device-authorization-response)
 * id : a numeric client id used for referring to multiple clients in a server
 * validateChannelProtocol (optional) : whether or not to enable protocol validation for custom protocols using plugin channels. Defaults to true


## mc.Client(isServer,version,[customPackets])

Create a new client, if `isServer` is true then it is a server-side client, otherwise it's a client-side client.
Takes a minecraft `version` as second argument.

### client.write(name, params)

write a packet

### client.writeRaw(buffer)

write a raw buffer as a packet

### client.end(reason, fullReason)

Ends the connection with `reason` or `fullReason`
If `fullReason` is not defined, then the `reason` will be used.

`fullReason` is a JSON object, which represents [chat](https://wiki.vg/Chat) message.

### client.connect(port, host)

Used by the [Client Class](https://github.com/PrismarineJS/node-minecraft-protocol/blob/d9d01c8be4921bb38e7b59d9c18afd771615ba22/src/client.js) to connect to a server, done by createClient automatically

### client.setSocket(socket)

Sets the client's connection socket.

### client.registerChannel(name, typeDefinition, custom)

Registers a plugin channel with the given `name` and protodef `typeDefinition`

### client.unregisterChannel(name)

Unregisters a plugin channel.

### client.writeChannel(channel, params)

Write to [Plugin Channels](https://wiki.vg/Plugin_channels)

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

The user's session, as returned by the Yggdrasil system. (only client-side)

### client.profile

The player's profile, as returned by the Yggdrasil system. (only server-side)

### client.latency

The latency of the client, in ms. Updated at each keep alive.

### client.customPackets

An object index by version/state/direction/name, see client_custom_packet for an example

### client.protocolVersion

The client's protocol version

### client.version

The client's version

### `packet` event

Called with every packet parsed. Takes four paramaters, the JSON data we parsed, the packet metadata (name, state), the buffer (raw data) and the full buffer (includes surplus data and may include the data of following packets on versions below 1.8) 

### `raw` event

Called with every packet, but as a buffer. Takes two params, the buffer
and the packet metadata (name, state)

### `connect` event

when the socket connects to the server, this is emitted

### `end` event

Called when the client's connection is disconnected. Takes the reason as parameter

### `session` event

Called when user authentication is resolved. Takes session data as parameter.

### `state` event

Called when the protocol changes state. Takes the new state and old state as
parameters.

### `error` event

Called when an error occurs within the client. Takes an Error as parameter.

### per-packet events

Check out the [minecraft-data docs](https://prismarinejs.github.io/minecraft-data/?v=1.8&d=protocol) to know the event names and data field names.


### client.writeChannel(channel, params)

write a packet to a plugin channel


### client.registerChannel(name, typeDefinition, [custom])

Register a channel `name` using the protodef `typeDefinition` and sending the register packet if `custom` is true.

Start emitting channel events of the given name on the client object.

### client.unregisterChannel(name, [custom])

Unregister a channel `name` and send the unregister packet if `custom` is true.


## Not Immediately Obvious Data Type Formats

Note : almost all data formats can be understood by looking at
 [minecraft-data docs](https://prismarinejs.github.io/minecraft-data/?v=1.8&d=protocol)
 or [minecraft-data protocol.json](https://github.com/PrismarineJS/minecraft-data/blob/master/data/1.8/protocol.json)

### entityMetadata

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


## mc.ping(options, callback)

`options` is an object containing the following:
* host : default to localhost
* port : default to 25565
* version: default to most recent version

Ping a minecraft server and return a promise or use an optional callback containing the information about it

returns: `promise( <pending> ).then(pingResult).catch(err)`
callback `callback(err, pingResults)`

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


## mc.states

The minecraft protocol states.

## mc.supportedVersions

The supported minecraft versions.

## mc.defaultVersion

The current default minecraft version.

## mc.createSerializer({ state = states.HANDSHAKING, isServer = false , version})

Returns a minecraft protocol [serializer](https://github.com/roblabla/ProtoDef#serializerprotomaintype) for these parameters.


## mc.createDeserializer({ state = states.HANDSHAKING, isServer = false, packetsToParse = {"packet": true}, version })

Returns a minecraft protocol [deserializer](https://github.com/roblabla/ProtoDef#parserprotomaintype) for these parameters.


