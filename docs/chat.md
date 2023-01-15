## About chat signing

Starting in Minecraft 1.19, client messages sent to the server are signed and then broadcasted to other players.
Other clients receiving a signed message can verify that a message was written by a particular player as opposed
to being modified by the server. The way this is achieved is by the client asking Mojang's servers for signing keys,
and the server responding with a private key that can be used to sign messages, and a public key that can be used to
verify the messages.

When a client connects to the server, it sends its public key to the server, which then sends that to other players
that are on the server. The server also does some checks during the login procedure to authenticate the validity of
the public key, to ensure it came from Mojang. This is achieved by the client sending along a signature from Mojang's
servers in the login step which is the output of concatenating and signing the public key, player UUID and timestamp 
with a special Mojang private key specifically for signature validation. The public key used to verify this 
signature is public and is stored statically inside  node-minecraft-protocol (src/server/constants.js). 

Back to the client, when other players join the server they also get a copy of the players' public key for chat verification.
The clients can then verify that a message came from a client as well as do secondary checks like verifying timestamps.
This feature is designed to allow players to report chat messages from other players to Mojang. When the client reports a
message the contents, the sender UUID, timestamp, and signature are all sent so the Mojang server can verify the message 
and send it for moderator review.

Note: Since the server sends the public key, it's possible that the server can spoof the key and return a fake one, so
only Mojang can truly know if a message came from a client (as it stores its own copy of the clients' chat key pair).

## 1.19.1

Starting with 1.19.1, instead of signing the message itself, a SHA256 hash of the message and last seen messages are
signed instead. In addition, the payload of the hash is prepended with the signature of the previous message sent by the same client,
creating a signed chain of chat messages. See publicly available documentation for more detailed information on this.

Since chat verification happens on the client-side (as well as server side), all clients need to be kept up to date
on messages from other users. Since not all messages are public (for example, a player may send a signed private message),
the server can send a `chat_header` packet containing the aforementioned SHA256 hash of the message which the client
can generate a signature from, and store as the last signature for that player (maintaining chain integrity).

In the client, inbound player chat history is now stored in chat logs (in a 1000 length array). This allows players
to search through last seen messages when reporting messages.

When reporting chat messages, the chained chat functionality and chat history also securely lets Mojang get 
authentic message context before and after a reported message.

## Extra details

### 1.19.1

When a server sends a player a message from another player, the server saves the outbound message and expects
that the client will acknowledge that message, either in a outbound `chat_message` packet's lastSeen field,
or in a `message_acknowledgement` packet. (If the client doesn't seen any chat_message's to the server and
lots of messages pending ACK queue up, a serverbound `message_acknowledgement` packet will be sent to flush the queue.)

In the server, upon reviewal of the ACK, those messages removed from the servers' pending array. If too many
pending messages pile up, the client will get kicked.

In nmp server, you must call `client.logSentMessageFromPeer(packet)` when the server receives a message from a player and that message gets broadcast to other players in player_chat packets. This function stores these packets so the server can then verify a player's lastSeenMessages field in inbound chat packets to ensure chain integrity (as described above).