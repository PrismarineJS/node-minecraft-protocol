## FAQ

This Frequently Asked Question document is meant to help people for the most common things.

### How to hide errors ?

Use `hideErrors: true` in createClient options
You may also choose to add these listeners :
```js
client.on('error', () => {})
client.on('end', () => {})
```
