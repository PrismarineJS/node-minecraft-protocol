const Transform = require('readable-stream').Transform
const crypto = require('crypto')
const aesjs = require('aes-js')

function createCipher (secret) {
  if (crypto.getCiphers().includes('aes-128-cfb8')) {
    return crypto.createCipheriv('aes-128-cfb8', secret, secret)
  }
  return new Cipher(secret)
}

function createDecipher (secret) {
  if (crypto.getCiphers().includes('aes-128-cfb8')) {
    return crypto.createDecipheriv('aes-128-cfb8', secret, secret)
  }
  return new Decipher(secret)
}

class Cipher extends Transform {
  constructor (secret) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, enc, cb) {
    try {
      const res = this.aes.encrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

class Decipher extends Transform {
  constructor (secret) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, enc, cb) {
    try {
      const res = this.aes.decrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

module.exports = {
  createCipher,
  createDecipher
}
