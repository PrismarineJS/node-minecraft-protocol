'use strict'

const crypto = require('crypto')
const { Transform } = require('stream')

if (crypto.getCiphers().indexOf('aes-128-cfb8') !== -1) {
  // Native supported
  module.exports.createCipher = function (secret) {
    return crypto.createCipheriv('aes-128-cfb8', secret, secret)
  }

  module.exports.createDecipher = function (secret) {
    return crypto.createDecipheriv('aes-128-cfb8', secret, secret)
  }
} else {
  // aes-js fallback
  const aesjs = require('aes-js')

  class Cipher extends Transform {
    constructor (key) {
      super()
      // eslint-disable-next-line
      this.aes = new aesjs.ModeOfOperation.cfb(key, key, 8)
    }

    _transform (chunk, enc, cb) {
      try {
        cb(null, this.aes.encrypt(Buffer.concat([chunk, Buffer.alloc(chunk.length % 8)]))
      } catch (e) {
        cb(e)
      }
    }
  }

  class Decipher extends Cipher {
    _transform (chunk, enc, cb) {
      try {
        cb(null, this.aes.decrypt(Buffer.concat([chunk, Buffer.alloc(chunk.length % 8)])))
      } catch (e) {
        cb(e)
      }
    }
  }

  module.exports.createCipher = function (secret) {
    return new Cipher(secret)
  }

  module.exports.createDecipher = function (secret) {
    return new Decipher(secret)
  }
}
