# FAQ

This Frequently Asked Question document is meant to help people for the most common things.

## How to hide errors ?

Use `hideErrors: true` in createClient options
You may also choose to add these listeners :

```js
client.on('error', () => {})
client.on('end', () => {})
```

## How can I make a proxy with this ?

* Check out our WIP proxy lib <https://github.com/PrismarineJS/prismarine-proxy>
* See this example <https://github.com/PrismarineJS/node-minecraft-protocol/tree/master/examples/proxy>
* Read this issue <https://github.com/PrismarineJS/node-minecraft-protocol/issues/712>
* check out <https://github.com/Heath123/pakkit>
* Check out this app <https://github.com/wvffle/minecraft-packet-debugger>

## Can you support alternative auth methods?

Supporting alternative authentcation methods has been a long standing issue with Prismarine for awhile. We do add support for using your own custom authentication method by providing a function to the `options.auth` property. In order to keep the legitimacy of the project, and to prevent bad attention from Mojang, we will not be supporting any custom authentication methods in the official repositories.

It is up to the end user to support and maintain the authentication protocol if this is used as support in many of the official channels will be limited.

If you still wish to proceed, please make sure to throughly read and attempt to understand all implementations of the authentcation you wish to implement. Using an non-official authentication server can make you vulnerable to all different kinds of attacks which are not limited to insecure and/or malicious code! We will not be held responsible for anything you mess up.
