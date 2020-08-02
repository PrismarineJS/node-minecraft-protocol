'use strict'

const crypto = require('crypto')

if (crypto.getCiphers().indexOf('aes-128-cfb8') !== -1) {
    // Native supported
    module.exports.createCipher = function(secret) {
        return crypto.createCipheriv('aes-128-cfb8', secret, secret)
    }

    module.exports.createDecipher = function(secret) {
        return crypto.createDecipheriv('aes-128-cfb8', secret, secret)
    }

} else {
    // Fallback
    const { Transform } = require('stream');

    const CryptoJS = require("crypto-js/core");
    require("crypto-js/x64-core");
    require("crypto-js/cipher-core");

    require("crypto-js/enc-hex")
    require("crypto-js/pad-nopadding");

    require("crypto-js/aes");
    //require("crypto-js/mode-cfb");
    CryptoJS.mode.CFBb = require("cryptojs-extension/build_node/mode-cfb-b");

    console.log("Using crypto-js fallback")

    class Cipher extends Transform {
        constructor(secret) {
            super();
            this.key = secret;
            this.iv = this.key;
        }

        // Conversion functions taken from https://gist.github.com/artjomb/7ef1ee574a411ba0dd1933c1ef4690d1
        /*byteArrayToWordArray(ba) { //Should be used later, currently just using hex to convert stuff
            var wa = [],
                i;
            for (i = 0; i < ba.length; i++) {
                wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
            }
            return CryptoJS.lib.WordArray.create(wa, ba.length);
        }*/

        wordToByteArray(word, length) {
            var ba = [],
                i,
                xFF = 0xFF;
            if (length > 0)
                ba.push(word >>> 24);
            if (length > 1)
                ba.push((word >>> 16) & xFF);
            if (length > 2)
                ba.push((word >>> 8) & xFF);
            if (length > 3)
                ba.push(word & xFF);

            return ba;
        }

        wordArrayToByteArray(wordArray, length) {
            if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
                length = wordArray.sigBytes;
                wordArray = wordArray.words;
            }

            var result = [],
                bytes,
                i = 0;
            while (length > 0) {
                bytes = this.wordToByteArray(wordArray[i], Math.min(4, length));
                length -= bytes.length;
                result.push(bytes);
                i++;
            }
            return [].concat.apply([], result);
        }


        _transform(chunk, enc, cb) {
            try {
                //console.log("enc:" + enc);
                //console.log("c-in", chunk)

                let encrypted = CryptoJS.AES.encrypt(
                    CryptoJS.enc.Hex.parse(chunk.toString('hex')),
                    CryptoJS.enc.Hex.parse(this.key.toString('hex')), {
                        iv: CryptoJS.enc.Hex.parse(this.iv.toString('hex')),
                        mode: CryptoJS.mode.CFBb,
                        segmentSize: 8,
                        padding: CryptoJS.pad.NoPadding
                    }
                )

                //console.log("ct:", encrypted.ciphertext)
                let cout = Buffer.from(this.wordArrayToByteArray(encrypted.ciphertext));
                //console.log("c-out", cout)
                this.iv = cout.slice(cout.length - 16, cout.length);

                cb(null, cout);
            } catch (e) {
                cb(e); //This can cause "Error [ERR_MULTIPLE_CALLBACK]: Callback called multiple times" when an error was thrown while calling cb in the try block.
            }
        }
    }

    class Decipher extends Cipher {
        _transform(chunk, enc, cb) {
            try {
                //console.log("enc:" + enc);
                //console.log("dc-in", chunk)

                let inp = CryptoJS.enc.Hex.parse(chunk.toString('hex')); //hex and binary
                //console.log("dc-in2", inp);

                let decrypted = CryptoJS.AES.decrypt( //
                    { ciphertext: inp },
                    CryptoJS.enc.Hex.parse(this.key.toString('hex')), //
                    {
                        iv: CryptoJS.enc.Hex.parse(this.iv.toString('hex')),
                        mode: CryptoJS.mode.CFBb,
                        segmentSize: 8,
                        padding: CryptoJS.pad.NoPadding
                    }
                );

                let resbuf = Buffer.from(this.wordArrayToByteArray(decrypted));
                //console.log("dc-out", resbuf)
                this.iv = chunk.slice(chunk.length - 16, chunk.length);

                cb(null, resbuf);
            } catch (e) {
                cb(e);
            }
        }
    }

    module.exports.createCipher = function(secret) {
        return new Cipher(secret)
    }

    module.exports.createDecipher = function(secret) {
        return new Decipher(secret)
    }
}