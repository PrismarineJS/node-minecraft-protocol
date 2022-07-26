const crypto = require('node:crypto')
const UUID = require('uuid-1345')

// authlib-3.4.40
const YGGDRASIL_SESSION_PUBKEY_20220726 = crypto.createPublicKey(`\
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAylB4B6m5lz7jwrcFz6Fd
/fnfUhcvlxsTSn5kIK/2aGG1C3kMy4VjhwlxF6BFUSnfxhNswPjh3ZitkBxEAFY2
5uzkJFRwHwVA9mdwjashXILtR6OqdLXXFVyUPIURLOSWqGNBtb08EN5fMnG8iFLg
EJIBMxs9BvF3s3/FhuHyPKiVTZmXY0WY4ZyYqvoKR+XjaTRPPvBsDa4WI2u1zxXM
eHlodT3lnCzVvyOYBLXL6CJgByuOxccJ8hnXfF9yY4F0aeL080Jz/3+EBNG8RO4B
yhtBf4Ny8NQ6stWsjfeUIvH7bU/4zCYcYOq4WrInXHqS8qruDmIl7P5XXGcabuzQ
stPf/h2CRAUpP/PlHXcMlvewjmGU6MfDK+lifScNYwjPxRo4nKTGFZf/0aqHCh/E
AsQyLKrOIYRE0lDG3bzBh8ogIMLAugsAfBb6M3mqCqKaTMAf/VAjh5FFJnjS+7bE
+bZEV0qwax1CEoPPJL1fIQjOS8zj086gjpGRCtSy9+bTPTfTR/SJ+VUB5G2IeCIt
kNHpJX2ygojFZ9n5Fnj7R9ZnOM+L8nyIjPu3aePvtcrXlyLhH/hvOfIOjPxOlqW+
O5QwSFP4OEcyLAUgDdUgyW36Z5mB285uKW/ighzZsOTevVUG2QwDItObIV6i8RCx
FbN2oDHyPaO5j1tTaBNyVt8CAwEAAQ==
-----END PUBLIC KEY-----`)

/**
 * verifies a client's pubKey using an authority-supplied signature of it
 * @param { Buffer } pubKey Public Key bytes
 * @param { Date } expiresAt when the key expires
 * @param { Buffer } signature when the key expires
 * @param { {
 *  version: number | undefined,
 *  authority_pubkey: crypto.KeyObject | undefined
 * } | undefined } options extra options like using a different authorities' pubkey
 * @returns {boolean}
 */
function verifyPubKey (pubKey, expiresAt, signature, options = {}) {
  const version = options.version ?? 0

  switch (version) {
    case 0:
      return crypto.verify(
        'RSA-SHA1',
        Buffer.from(expiresAt.getTime() + pubKey, 'ascii'),
        options.authority_pubkey ?? YGGDRASIL_SESSION_PUBKEY_20220726,
        signature
      )
    default:
      return false
  }
}

/**
 * signs a message
 * @param { string | Buffer } message the message to be signed
 * @param { {
 *  privateKey: crypto.KeyObject,
 *  salt: number | bigint | undefined,
 *  uuid: Buffer,
 *  timestamp: number | bigint | undefined
 * } } options various objects needed to create the signature
 * @returns {
 *  salt: number | bigint,
 *  timestamp: number | bigint,
 *  signature: Buffer
 * } the signature, used salt and timestamp
 */
function sign (message, options) {
  const privateKey = options.privateKey

  if (!privateKey) return

  const salt = options.salt ?? 0
  const uuid = UUID.parse(options.uuid)
  const timestamp = options.timestamp ?? Date.now()

  const algorithm = options.algorithm ?? 'RSA-SHA256'
  const sign = crypto.createSign(algorithm)

  updateSignature(sign, salt, uuid, timestamp, message)

  const signature = sign.sign(privateKey)

  return { salt, timestamp, signature }
}

/**
 * verifies if a signature is valid
 * @param { string | Buffer } message the message received with the signature
 * @param { string | Buffer } signature the signature to be verified
 * @param { {
 *  publicKey: crypto.KeyObject,
 *  salt: number | bigint | undefined,
 *  uuid: Buffer,
 *  timestamp: number | bigint
 * } } options various objects needed to verify the signature
 * @returns { boolean } if the signature is valid
 */
function verify (message, signature, options) {
  const publicKey = options.publicKey

  if (!publicKey) return false

  const salt = options.salt ?? 0
  const uuid = UUID.parse(options.uuid)
  const timestamp = options.timestamp

  if (!timestamp) return false

  const algorithm = options.algorithm ?? 'RSA-SHA256'
  const verify = crypto.createVerify(algorithm)

  updateSignature(verify, salt, uuid, timestamp, message)

  return verify.verify(publicKey, signature)
}
/**
 * writes salt, uuid, timestamp and message in a specific format to the
 * cryptographic entity
 * @param { crypto.Verify | crypto.Sign } signer sink to be written to
 * @param { number | bigint } salt random number
 * @param { Buffer } uuid parsed player uuid
 * @param { number | bigint } timestamp time in millis
 * @param { string | Buffer } message the message to be signed
 */
function updateSignature (signer, salt, uuid, timestamp, message) {
  const buffer = Buffer.alloc(32)
  // salt
  buffer.writeBigUInt64BE(BigInt(salt), 0)
  // uuid
  buffer.writeBigUInt64BE(uuid.readBigUInt64BE(0), 8)
  buffer.writeBigUInt64BE(uuid.readBigUInt64BE(8), 16)
  // timestamp
  buffer.writeBigUInt64BE(BigInt(timestamp), 24)
  signer.update(buffer)

  // message
  signer.update(message)
}

/**
 * turns a string into sendable bytes
 * @param { string } key the key to strip and parse
 * @param {'public' | 'private'} kind which kind of header and footer to remove
 * @param { boolean | undefined } whack whether or not to search for headers and footers containing 'RSA'
 * @returns { Buffer }
 */
function getBytesFromKeyString (key, kind = 'public', whack = false) {
  const KIND = (whack ? 'RSA ' : '') + (kind === 'public' ? 'PUBLIC' : 'PRIVATE')
  const START = `-----BEGIN ${KIND} KEY-----`
  let start = key.indexOf(START)
  start = start === -1 ? 0 : start + START.length
  const END = `-----END ${KIND} KEY-----`
  const end = key.indexOf(END)
  return Buffer.from(key.substring(start, end !== -1 ? end : undefined), 'base64')
}

/**
 * turns bytes back into parsable or verifiable strings
 * output will be exactly 76 chars per base64 line so that the signature stays
 * verifiable
 * @param { Buffer } bytes input data
 * @param {'public' | 'private'} kind if to put PUBLIC or PRIVATE in header and footer
 * @param { boolean } whack whether or not to put 'RSA' into the header and footer
 * @returns { string }
 */
function getKeyStringFromBytes (bytes, kind = 'public', whack = false) {
  const KIND = (whack ? 'RSA ' : '') + (kind === 'public' ? 'PUBLIC' : 'PRIVATE')
  return `-----BEGIN ${KIND} KEY-----\n${bytes.toString('base64').replace(/.{76}/g, '$&\n')}\n-----END ${KIND} KEY-----\n`
}

/**
 * @returns { bigint } random i64 bigint
 */
function salt () {
  const buffer = Buffer.alloc(8)
  crypto.randomFillSync(buffer)
  return buffer.readBigInt64BE()
}

module.exports = {
  sign,
  verify,
  verifyPubKey,
  getBytesFromKeyString,
  getKeyStringFromBytes,
  salt
}
