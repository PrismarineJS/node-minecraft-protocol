// Copyright 2012 The Obvious Corporation.

/*
 * "ursa": RSA crypto, with an emphasis on Buffer objects
 */

/*
 * Modules used
 */

"use strict";

// Note: This also forces OpenSSL to be initialized, which is important!
var crypto = require("crypto");

var assert = require("assert");

//var ursaNative = require("../bin/ursaNative");
var ursaNative = require("node-rsa");

var RsaWrap    = ursaNative;
//var textToNid  = ursaNative.textToNid;


/*
 * Variable definitions
 */

/** encoding constant */
var BASE64 = "base64";

/** encoding constant */
var BINARY = "binary";

/** encoding constant */
var HEX = "hex";

/** type name */
var STRING = "string";

/** encoding constant */
var UTF8 = "utf8";

/** hash algorithm constant */
var MD5 = "md5";

/** regex that matches PEM files, capturing the file type */
var PEM_REGEX = 
    /^(-----BEGIN (.*) KEY-----\r?\n[\/+=a-zA-Z0-9\r\n]*\r?\n-----END \2 KEY-----\r?\n)/m;

/** "unsealer" key object to authenticate objects */
var theUnsealer = [ "ursa unsealer" ];


/*
 * Helper functions
 */

/**
 * Return true iff x is either a string or a Buffer.
 */
function isStringOrBuffer(x) {
  return (typeof x === STRING) || Buffer.isBuffer(x);
}

/**
 * Extract and identify the PEM file type represented in the given
 * buffer. Returns the extracted type string or undefined if the
 * buffer doesn't seem to be any sort of PEM format file.
 */
function identifyPemType(buf) {
  var str = encodeBuffer(buf, UTF8);
  var match = PEM_REGEX.exec(str);

  if (!match) {
      return undefined;
  }

  return match[2];
}

/**
 * Return whether the given buffer or string appears (trivially) to be a 
 * valid public key file in PEM format.
 */
function isPublicKeyPem(buf) {
  var kind = identifyPemType(buf);
  return (kind == "PUBLIC");
}

/**
 * Return whether the given buffer or string appears (trivially) to be a 
 * valid private key file in PEM format.
 */
function isPrivateKeyPem(buf) {
  var kind = identifyPemType(buf);
  return (kind == "RSA PRIVATE");
}

/**
 * Return a buffer containing the encoding of the given bigint for use
 * as part of an SSH-style public key file. The input value must be a
 * buffer representing an unsigned bigint in big-endian order.
 */
function toSshBigint(value) {
  // The output is signed, so we need to add an extra 00 byte at the
  // head if the high-order bit is set.
  var prefix00 = ((value[0] & 0x80) !== 0);
  var length = value.length + (prefix00 ? 1 : 0);
  var result = new Buffer(length + 4);
  var offset = 0;

  result.writeUInt32BE(length, offset);
  offset += 4;

  if (prefix00) {
    result[offset] = 0;
    offset++;
  }

  value.copy(result, offset);
  return result;
}

/**
 * Create and return a buffer containing an SSH-style public key file for
 * the given RsaWrap object.
 *
 * For the record, an SSH-style public key file consists of three
 * concatenated values, each one length-prefixed:
 *
 *     literal string "ssh-rsa"
 *     exponent
 *     modulus
 *
 * The literal string header is length-prefixed.  The two numbers are
 * represented as signed big-int values in big-endian order, also
 * length-prefixed.
 */
function createSshPublicKey(rsa) {
  var e = toSshBigint(rsa.getExponent());
  var m = toSshBigint(rsa.getModulus());

  var header = toSshBigint(new Buffer("ssh-rsa", UTF8));
  var result = new Buffer(header.length + m.length + e.length);
  var offset = 0;

  header.copy(result, offset);
  offset += header.length;
  e.copy(result, offset);
  offset += e.length;
  m.copy(result, offset);

  return result;
}

/**
 * Validate the given encoding name. Throws an exception if invalid.
 */
function validateEncoding(encoding) {
  switch (encoding) {
    case BASE64:
    case BINARY:
    case HEX:
    case UTF8: {
      // These are all valid.
      break;
    }
    default: {
      throw new Error("Invalid encoding: " + encoding);
    }
  }
}

/**
 * Convert a buffer into an appropriately-encoded string, or return it
 * unmodified if the encoding is undefined.
 */
function encodeBuffer(buf, encoding) {
  if (encoding === undefined) {
    return buf;
  }

  validateEncoding(encoding);
  return buf.toString(encoding);
}

/**
 * Return a buffer or undefined argument as-is, or convert a given
 * string into a buffer by using the indicated encoding. An undefined
 * encoding is interpreted to mean UTF8.
 */
function decodeString(str, encoding) {
  if ((str === undefined) || Buffer.isBuffer(str)) {
    return str;
  }

  if (encoding === undefined) {
    encoding = UTF8;
  }

  validateEncoding(encoding);
  return new Buffer(str, encoding);
}

/**
 * Public Key object. This is the externally-visible object that one gets
 * when constructing an instance from a public key. The constructor takes
 * a native RsaWrap object.
 */
function PublicKey(rsa) {
  var self;

  function getExponent(encoding) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(rsa.keyPair.e);
    return encodeBuffer(buf, encoding);
  }

  function getModulus(encoding) {
    var buf = new Buffer(4);
    // TODO : How do I get modulus ?
    return encodeBuffer(rsa.getModulus(), encoding);
  }

  function toPublicPem(encoding) {
    return encodeBuffer(rsa.getPublicPEM(), encoding);
  }

  function toPublicSsh(encoding) {
      return encodeBuffer(createSshPublicKey(rsa), encoding);
  }

  function toPublicSshFingerprint(encoding) {
      return sshFingerprint(createSshPublicKey(rsa), undefined, encoding);
  }

  function encrypt(buf, bufEncoding, outEncoding, padding) {
    buf = decodeString(buf, bufEncoding);
    padding = padding || ursaNative.RSA_PKCS1_OAEP_PADDING;
    return rsa.encrypt(buf);
    //return encodeBuffer(rsa.publicEncrypt(buf, padding), outEncoding);
  }

  function publicDecrypt(buf, bufEncoding, outEncoding) {
    throw new Exception("Unsupported operation : publicDecrypt");
    //buf = decodeString(buf, bufEncoding);
    //return encodeBuffer(rsa.publicDecrypt(buf), outEncoding);
  }

  function verify(algorithm, hash, sig, encoding) {
    //algorithm = textToNid(algorithm);
    hash = decodeString(hash, encoding);
    sig = decodeString(sig, encoding);
    rsa.options.signingAlgorithm = algorithm;
    return rsa.verify(hash, sig);
  }

  function hashAndVerify(algorithm, buf, sig, encoding) {
    var verifier = createVerifier(algorithm);
    verifier.update(buf, encoding);
    return verifier.verify(self, sig, encoding);
  }

  function unseal(unsealer) {
    return (unsealer === theUnsealer) ? self : undefined;
  }

  self = {
      encrypt:                encrypt,
      getExponent:            getExponent,
      getModulus:             getModulus,
      hashAndVerify:          hashAndVerify,
      publicDecrypt:          publicDecrypt,
      toPublicPem:            toPublicPem,
      toPublicSsh:            toPublicSsh,
      toPublicSshFingerprint: toPublicSshFingerprint,
      verify:                 verify,
      unseal:                 unseal
  };

  return self;
}

/**
 * Private Key object. This is the externally-visible object that one
 * gets when constructing an instance from a private key (aka a
 * keypair). The constructor takes a native RsaWrap object.
 */
function PrivateKey(rsa) {
    var self;

    function toPrivatePem(encoding) {
      return encodeBuffer(rsa.getPrivatePEM(), encoding);
    }

    function decrypt(buf, bufEncoding, outEncoding, padding) {
      buf = decodeString(buf, bufEncoding);
      padding = padding || ursaNative.RSA_PKCS1_OAEP_PADDING;
      return encodeBuffer(rsa.decrypt(buf), outEncoding);
      //return encodeBuffer(rsa.privateDecrypt(buf, padding), outEncoding);
    }

    function privateEncrypt(buf, bufEncoding, outEncoding) {
      throw new Exception("Unsupported operation : Private encrypt");
      buf = decodeString(buf, bufEncoding);
      return encodeBuffer(rsa.privateEncrypt(buf), outEncoding);
    }

    function sign(algorithm, hash, hashEncoding, outEncoding) {
      //algorithm = textToNid(algorithm);
      hash = decodeString(hash, hashEncoding);
      rsa.options.signingAlgorithm = algorithm;
      return encodeBuffer(rsa.sign(hash), outEncoding);
    }

    function hashAndSign(algorithm, buf, bufEncoding, outEncoding) {
        var signer = createSigner(algorithm);
        signer.update(buf, bufEncoding);
        return signer.sign(self, outEncoding);
    }

    self = PublicKey(rsa);
    self.decrypt        = decrypt;
    self.hashAndSign    = hashAndSign;
    self.privateEncrypt = privateEncrypt;
    self.sign           = sign;
    self.toPrivatePem   = toPrivatePem;
    return self;
}


/*
 * Exported bindings
 */

/**
 * Create a new public key object, from the given PEM-encoded file.
 */
function createPublicKey(pem, encoding) {
    var rsa = new RsaWrap();
    //pem = decodeString(pem, encoding);

    try {
        rsa.loadFromPEM(pem);
    } catch (ex) {
        if (!isPublicKeyPem(pem)) {
            throw new Error("Not a public key.");
        }
        throw ex;
    }

    return PublicKey(rsa);
}

/**
 * Create a new private key object, from the given PEM-encoded file,
 * optionally decrypting the file with a password.
 */
function createPrivateKey(pem, password, encoding) {
  var rsa = new RsaWrap();
  //pem = decodeString(pem, encoding);
  //password = decodeString(password, encoding);

  try {
    // Note: The native code is sensitive to the actual number of
    // arguments. It's *not* okay to pass undefined as a password.
    if (password) {
      throw new Exception("Unsupported method : createPrivateKey with password");
        //rsa.setPrivateKeyPem(pem, password);
    } else {
      rsa.loadFromPEM(pem);
    }
  } catch (ex) {
    if (!isPrivateKeyPem(pem)) {
      throw new Error("Not a private key.");
    }
    throw ex;
  }

  return PrivateKey(rsa);
}

/**
 * Generate a new private key object (aka a keypair).
 */
function generatePrivateKey(modulusBits, exponent) {
  if (modulusBits === undefined) {
      modulusBits = 2048;
  }

  if (exponent === undefined) {
      exponent = 65537;
  }

  var rsa = new RsaWrap();
  rsa.generateKeyPair(modulusBits, exponent);

  return PrivateKey(rsa);
}

/**
 * Create a key object from a PEM format file, either a private or
 * public key depending on what kind of file is passed in. If given
 * a private key file, it must not be encrypted.
 */
function createKey(pem, encoding) {
    pem = decodeString(pem, encoding);

    if (isPublicKeyPem(pem)) {
        return createPublicKey(pem);
    } else if (isPrivateKeyPem(pem)) {
        return createPrivateKey(pem);
    } else {
        throw new Error("Not a key.");
    }
}

/**
 * Return the SSH-style public key fingerprint of the given SSH-format
 * public key.
 */
function sshFingerprint(sshKey, sshEncoding, outEncoding) {
    var hash = crypto.createHash(MD5);

    hash.update(decodeString(sshKey, sshEncoding));
    var result = new Buffer(hash.digest(BINARY), BINARY);
    return encodeBuffer(result, outEncoding);
}

/**
 * Return whether the given object is a key object (either public or
 * private), as constructed by this module.
 */
function isKey(obj) {
    var obj2;

    try {
        var unseal = obj.unseal;
        if (typeof unseal !== "function") {
            return false;
        }
        obj2 = unseal(theUnsealer);
    } catch (ex) {
        // Ignore; can't assume that other objects obey any particular
        // unsealing protocol.
        // TODO: Log?
        return false;
    }

    return obj2 !== undefined;
}

/**
 * Return whether the given object is a private key object, as
 * constructed by this module.
 */
function isPrivateKey(obj) {
  return isKey(obj) && (obj.decrypt !== undefined);
}

/**
 * Return whether the given object is a public key object (per se), as
 * constructed by this module.
 */
function isPublicKey(obj) {
    return isKey(obj) && !isPrivateKey(obj);
}

/**
 * Assert wrapper for isKey().
 */
function assertKey(obj) {
    assert(isKey(obj));
}

/**
 * Assert wrapper for isPrivateKey().
 */
function assertPrivateKey(obj) {
    assert(isPrivateKey(obj));
}

/**
 * Assert wrapper for isPublicKey().
 */
function assertPublicKey(obj) {
    assert(isPublicKey(obj));
}

/**
 * Coerce the given key value into an private key object, returning
 * it. If given a private key object, this just returns it as-is. If
 * given a string or Buffer, it tries to parse it as PEM. Anything
 * else is an error.
 */
function coercePrivateKey(orig) {
    if (isPrivateKey(orig)) {
        return orig;
    } else if (isStringOrBuffer(orig)) {
        return createPrivateKey(orig);
    }

    throw new Error("Not a private key: " + orig);
}

/**
 * Coerce the given key value into a public key object, returning
 * it. If given a private key object, this just returns it as-is. If
 * given a string or Buffer, it tries to parse it as PEM. Anything
 * else is an error.
 */
function coercePublicKey(orig) {
    if (isPublicKey(orig)) {
        return orig;
    } else if (isStringOrBuffer(orig)) {
        return createPublicKey(orig);
    }

    throw new Error("Not a public key: " + orig);
}

/**
 * Coerce the given key value into a key object (either public or
 * private), returning it. If given a private key object, this just
 * returns it as-is. If given a string or Buffer, it tries to parse it
 * as PEM. Anything else is an error.
 */
function coerceKey(orig) {
    if (isKey(orig)) {
        return orig;
    } else if (isStringOrBuffer(orig)) {
        return createKey(orig);
    }

    throw new Error("Not a key: " + orig);
}

/**
 * Check whether the two objects are both keys of some sort and
 * have the same public part.
 */
function matchingPublicKeys(key1, key2) {
    if (!(isKey(key1) && isKey(key2))) {
        return false;
    }

    // This isn't the most efficient implementation, but it will suffice:
    // We convert both to ssh form, which has very little leeway for
    // variation, and compare bytes.
    
    var ssh1 = key1.toPublicSsh(UTF8);
    var ssh2 = key2.toPublicSsh(UTF8);

    return ssh1 === ssh2;
}

/**
 * Check whether the two objects are both keys of some sort, are
 * both public or both private, and have the same contents.
 */
function equalKeys(key1, key2) {
    // See above for rationale. In this case, there's no ssh form for
    // private keys, so we just use PEM for that.

    if (isPrivateKey(key1) && isPrivateKey(key2)) {
        var pem1 = key1.toPrivatePem(UTF8);
        var pem2 = key2.toPrivatePem(UTF8);
        return pem1 === pem2;
    }

    if (isPublicKey(key1) && isPublicKey(key2)) {
        return matchingPublicKeys(key1, key2);
    }

    return false;
}

/**
 * Create a signer object.
 */
function createSigner(algorithm) {
    var hash = crypto.createHash(algorithm);

    function update(buf, bufEncoding) {
        buf = decodeString(buf, bufEncoding);
        hash.update(buf);
    }

    function sign(privateKey, outEncoding) {
        var hashBuf = new Buffer(hash.digest(BINARY), BINARY);
        return privateKey.sign(algorithm, hashBuf, undefined, outEncoding);
    }

    return {
        sign:   sign,
        update: update
    };
}

/**
 * Create a verifier object.
 */
function createVerifier(algorithm) {
    var hash = crypto.createHash(algorithm);

    function update(buf, bufEncoding) {
        buf = decodeString(buf, bufEncoding);
        hash.update(buf);
    }

    function verify(publicKey, sig, sigEncoding) {
        var hashBuf = new Buffer(hash.digest(BINARY), BINARY);
        sig = decodeString(sig, sigEncoding);
        return publicKey.verify(algorithm, hashBuf, sig);
    }

    return {
        update: update,
        verify: verify
    };
}


/*
 * Initialization
 */

module.exports = {
    assertKey:              assertKey,
    assertPrivateKey:       assertPrivateKey,
    assertPublicKey:        assertPublicKey,
    coerceKey:              coerceKey,
    coercePrivateKey:       coercePrivateKey,
    coercePublicKey:        coercePublicKey,
    createKey:              createKey,
    createPrivateKey:       createPrivateKey,
    createPublicKey:        createPublicKey,
    createSigner:           createSigner,
    createVerifier:         createVerifier,
    equalKeys:              equalKeys,
    generatePrivateKey:     generatePrivateKey,
    isKey:                  isKey,
    isPrivateKey:           isPrivateKey,
    isPublicKey:            isPublicKey,
    matchingPublicKeys:     matchingPublicKeys,
    sshFingerprint:         sshFingerprint,
    RSA_PKCS1_PADDING:      ursaNative.RSA_PKCS1_PADDING,
    RSA_PKCS1_OAEP_PADDING: ursaNative.RSA_PKCS1_OAEP_PADDING,
};
