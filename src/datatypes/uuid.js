const crypto = require('crypto')
const UUID = require('uuid-1345')

// https://github.com/openjdk-mirror/jdk7u-jdk/blob/f4d80957e89a19a29bb9f9807d2a28351ed7f7df/src/share/classes/java/util/UUID.java#L163
function javaUUID (s) {
  const hash = crypto.createHash('md5')
  hash.update(s, 'utf8')
  const buffer = hash.digest()
  buffer[6] = (buffer[6] & 0x0f) | 0x30
  buffer[8] = (buffer[8] & 0x3f) | 0x80
  return buffer
}

function nameToMcOfflineUUID (name) {
  return (new UUID(javaUUID('OfflinePlayer:' + name))).toString()
}

function fromIntArray (arr) {
  const buf = Buffer.alloc(16)
  arr.forEach((num, index) => { buf.writeInt32BE(num, index * 4) })
  return buf.toString('hex')
}

module.exports = { nameToMcOfflineUUID, fromIntArray }
