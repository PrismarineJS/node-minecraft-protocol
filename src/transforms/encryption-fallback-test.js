const encryption = require('./encryption');

/*

Test for crypto-js fallback
Change between fallback and nodejs crypto by editing the expression in encryption.js to true or false

########### Nodejs crypto

input     TextToEncryptAndThenDecrypt 27
encrypted 608e4df02a82de4a03c547e8f8ac3f924a6e962a43e9242ad5eaa5 27
decrypted TextToEncryptAndThenDecrypt 27

input     ThisIsTheSecondMessageForTheSameStream 38
encrypted 3379188d66a141f184b5175991fe8c7cfe7b20c7a4b7eb9382f4b645d0cbf5df4f84e298a880 38
decrypted ThisIsTheSecondMessageForTheSameStream 38


########### crypto-js

input     TextToEncryptAndThenDecrypt 27
encrypted 608e4df02a82de4a03c547e8f8ac3f924a6e962a43e9242ad5eaa5 27
decrypted TextToEncryptAndThenDecrypt 27

input     ThisIsTheSecondMessageForTheSameStream 38
encrypted 3379188d66a141f184b5175991fe8c7cfe7b20c7a4b7eb9382f4b645d0cbf5df4f84e298a880 38
decrypted ThisIsTheSecondMessageForTheSameStream 38

*/

//--- Setup

var key = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

const cipher = encryption.createCipher(key);
console.log("Cipher Init")
const decipher = encryption.createDecipher(key);
console.log("Decipher Init")

let decrypted = Buffer.alloc(0);
let encrypted = Buffer.alloc(0);

decipher.on('readable', () => {
    let chunk;
    while (true) {
        chunk = decipher.read()
        if (chunk == null) break;
        decrypted = Buffer.concat([decrypted, chunk]);
        //console.log(chunk)
    }
    console.log("decrypted", decrypted.toString('utf8'), decrypted.length);
    decrypted = Buffer.alloc(0);
});
decipher.on('end', () => {
    console.log("Decipher End")
});

cipher.on('readable', () => {
    let chunk;
    while (true) {
        chunk = cipher.read()
        if (chunk == null) break;
        //console.log(chunk)
        encrypted = Buffer.concat([encrypted, chunk]);
        decipher.write(chunk)
    }
    console.log("encrypted", encrypted.toString('hex'), encrypted.length);
    encrypted = Buffer.alloc(0);
});
cipher.on('end', () => {
    console.log("Cipher End")
});

//--- Start

const text = ['TextToEncryptAndThenDecrypt', "ThisIsTheSecondMessageForTheSameStream"];
const dlay = 500;

for (let i = 0; i < text.length; i++) {
    setTimeout(() => {
        console.log("")
        console.log("input    ", text[i], text[i].length)
        cipher.write(Buffer.from(text[i]));
    }, dlay * i)
}

setTimeout(() => {
    console.log("")
    cipher.end();
    decipher.end();
}, dlay * (text.length + 1));