'use strict'

const crypto = require('crypto')
const { Transform } = require('readable-stream')

if (!crypto.getCiphers().includes('aes-128-cfb8')) {
  const Cfb = require('aes-js').ModeOfOperation.cfb

  class Cipher extends Transform {
    constructor (sharedSecret) {
      super()
      this.aes = new Cfb(sharedSecret, sharedSecret, 8)
    }

    _transform (chunk, encoding, callback) {
      try {
        callback(null, this.aes.encrypt(Buffer.concat([chunk, Buffer.alloc(chunk.length % 8)])))
      } catch (exception) {
        callback(exception)
      }
    }
  }

  class Decipher extends Transform {
    constructor (sharedSecret) {
      super()
      this.aes = new Cfb(sharedSecret, sharedSecret, 8)
    }

    _transform (chunk, encoding, callback) {
      try {
        callback(null, this.aes.decrypt(Buffer.concat([chunk, Buffer.alloc(chunk.length % 8)])))
      } catch (exception) {
        callback(exception)
      }
    }
  }

  module.exports.createCipher = function (sharedSecret) {
    return new Cipher(sharedSecret)
  }

  module.exports.createDecipher = function (sharedSecret) {
    return new Decipher(sharedSecret)
  }
} else {
  module.exports.createCipher = function (sharedSecret) {
    return crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret)
  }

  module.exports.createDecipher = function (sharedSecret) {
    return crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret)
  }
}
