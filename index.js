var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , assert = require('assert')
  , Iconv = require('iconv').Iconv
  , ursa = require('ursa')
  , crypto = require('crypto')
  , superagent = require('superagent')
  , Batch = require('batch')
  , packets = require('./packets')
  , toUcs2 = new Iconv('UTF-8', 'utf16be')
  , fromUcs2 = new Iconv('utf16be', 'UTF-8')

require('buffer-more-ints');

exports.createClient = createClient;

function createClient(options) {
  // defaults
  assert.ok(options, "options is required");
  var port = options.port || 25565;
  var host = options.host || 'localhost';
  assert.ok(options.username, "username is required");
  var haveCredentials = options.email && options.password;

  var client = new Client();
  client.username = options.username;
  client.on('connect', function() {
    client.writePacket(0x02, {
      protocolVersion: packets.meta.protocolVersion,
      username: options.username,
      serverHost: host,
      serverPort: port,
    });
  });
  client.on(0x00, onKeepAlive);
  client.on(0xFC, onEncryptionKeyResponse);
  client.on(0xFD, onEncryptionKeyRequest);
  client.connect(port, host);

  return client;

  function onKeepAlive(packet) {
    client.writePacket(0x00, {
      keepAliveId: packet.keepAliveId
    });
  }

  function onEncryptionKeyRequest(packet) {
    var batch = new Batch();
    var hash;
    if (haveCredentials) {
      hash = crypto.createHash('sha1');
      hash.update(packet.serverId);
      batch.push(function(cb) { getLoginSession(options.email, options.password, cb); });
    }
    batch.push(function(cb) { crypto.randomBytes(16, cb); });
    batch.end(function (err, results) {
      if (err) {
        client.emit('error', err);
        client.end();
        return
      }

      var sharedSecret;
      if (haveCredentials) {
        client.session = results[0];
        client.username = client.session.username;
        client.emit('session');
        sharedSecret = results[1];
        joinServerRequest(onJoinServerResponse);
      } else {
        sharedSecret = results[0];
        sendEncryptionKeyResponse();
      }

      function onJoinServerResponse(err) {
        if (err) {
          client.emit('error', err);
          client.end();
        } else {
          sendEncryptionKeyResponse();
        }
      }

      function joinServerRequest(cb) {
        hash.update(sharedSecret);
        hash.update(packet.publicKey);

        var digest = mcHexDigest(hash);
        var request = superagent.get("http://session.minecraft.net/game/joinserver.jsp");
        request.query({
          user: client.session.username,
          sessionId: client.session.id,
          serverId: digest,
        });
        request.end(function(err, resp) {
          var myErr;
          if (err) {
            cb(err);
          } else if (resp.serverError) {
            myErr = new Error("session.minecraft.net is broken: " + resp.status);
            myErr.code = 'EMCSESSION500';
            cb(myErr);
          } else if (resp.clientError) {
            myErr = new Error("session.minecraft.net rejected request: " + resp.status + " " + resp.text);
            myErr.code = 'EMCSESSION400';
            cb(myErr);
          } else {
            cb();
          }
        });
      }

      function sendEncryptionKeyResponse() {
        var pubKey = mcPubKeyToURsa(packet.publicKey);
        var encryptedSharedSecret = pubKey.encrypt(sharedSecret, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
        var encryptedSharedSecretBuffer = new Buffer(encryptedSharedSecret, 'base64');
        var encryptedVerifyToken = pubKey.encrypt(packet.verifyToken, 'binary', 'base64', ursa.RSA_PKCS1_PADDING);
        var encryptedVerifyTokenBuffer = new Buffer(encryptedVerifyToken, 'base64');
        client.cipher = crypto.createCipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.decipher = crypto.createDecipheriv('aes-128-cfb8', sharedSecret, sharedSecret);
        client.writePacket(0xfc, {
          sharedSecret: encryptedSharedSecretBuffer,
          verifyToken: encryptedVerifyTokenBuffer,
        });
      }
    });
  }

  function onEncryptionKeyResponse(packet) {
    assert.strictEqual(packet.sharedSecret.length, 0);
    assert.strictEqual(packet.verifyToken.length, 0);
    client.encryptionEnabled = true;
    client.writePacket(0xcd, { payload: 0 });
  }
}

function Client(options) {
  EventEmitter.call(this);

  this.socket = null;
  this.encryptionEnabled = false;
  this.cipher = null;
  this.decipher = null;
}
util.inherits(Client, EventEmitter);

Client.prototype.connect = function(port, host) {
  var self = this;
  self.socket = net.connect(port, host, function() {
    self.emit('connect');
  });
  var incomingBuffer = new Buffer(0);
  self.socket.on('data', function(data) {
    if (self.encryptionEnabled) data = new Buffer(self.decipher.update(data), 'binary');
    incomingBuffer = Buffer.concat([incomingBuffer, data]);
    var parsed, packet;
    while (true) {
      parsed = parsePacket(incomingBuffer);
      if (! parsed) break;
      packet = parsed.results;
      hax(packet); // fuck you, notch
      incomingBuffer = incomingBuffer.slice(parsed.size);
      self.emit(packet.id, packet);
    }
  });

  self.socket.on('error', function(err) {
    self.emit('error', err);
  });

  self.socket.on('close', function() {
    self.emit('end');
  });
};

Client.prototype.end = function() {
  this.socket.end();
};

Client.prototype.writePacket = function(packetId, params) {
  var buffer = createPacketBuffer(packetId, params);
  var out = this.encryptionEnabled ? new Buffer(this.cipher.update(buffer), 'binary') : buffer;
  this.socket.write(out);
};

var writers = {
  'int': IntWriter,
  'short': ShortWriter,
  'byte': ByteWriter,
  'ubyte': UByteWriter,
  'string': StringWriter,
  'byteArray16': ByteArray16Writer,
  'bool': BoolWriter,
  'double': DoubleWriter,
  'float': FloatWriter,
  'slot': SlotWriter,
};

var readers = {
  'string': readString,
  'ascii': readAscii,
  'byteArray16': readByteArray16,
  'byteArray32': readByteArray32,
  'short': readShort,
  'ushort': readUShort,
  'int': readInt,
  'byte': readByte,
  'ubyte': readUByte,
  'long': readLong,
  'slot': readSlot,
  'bool': readBool,
  'double': readDouble,
  'float': readFloat,
  'slotArray': readSlotArray,
  'mapChunkBulk': readMapChunkBulk,
  'entityMetadata': readEntityMetadata,
  'objectData': readObjectData,
  'intArray': readIntArray,
  'intVector': readIntVector,
  'byteVector': readByteVector,
  'byteVectorArray': readByteVectorArray,
};

function readIntArray(buffer, offset) {
  var results = readByte(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var cursorEnd = cursor + 4 * count;
  if (cursorEnd > buffer.length) return null;
  var array = [];
  for (var i = 0; i < count; ++i) {
    array.push(buffer.readInt32BE(cursor));
    cursor += 4;
  }

  return {
    value: array,
    size: cursorEnd - offset,
  };
}

var entityMetadataReaders = {
  0: readByte,
  1: readShort,
  2: readInt,
  3: readFloat,
  4: readString,
  5: readSlot,
  6: readIntVector,
};

function readByteVectorArray(buffer, offset) {
  var results = readInt(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;
  var cursorEnd = cursor + 3 * count;
  if (cursorEnd > buffer.length) return null;

  var array = [];
  for (var i = 0; i < count; ++i) {
    array.push({
      x: buffer.readInt8(cursor),
      y: buffer.readInt8(cursor + 1),
      z: buffer.readInt8(cursor + 2),
    });
    cursor += 3;
  }
  return {
    value: array,
    size: cursorEnd - offset,
  };
}

function readByteVector(buffer, offset) {
  if (offset + 3 > buffer.length) return null;
  return {
    value: {
      x: buffer.readInt8(offset),
      y: buffer.readInt8(offset + 1),
      z: buffer.readInt8(offset + 2),
    },
    size: 3,
  };
}

function readIntVector(buffer, offset) {
  if (offset + 12 > buffer.length) return null;
  return {
    value: {
      x: buffer.readInt32BE(offset),
      y: buffer.readInt32BE(offset + 4),
      z: buffer.readInt32BE(offset + 8),
    },
    size: 12,
  };
}

function readEntityMetadata(buffer, offset) {
  var cursor = offset;
  var metadata = {};
  var item, key, type, results, reader;
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    item = buffer.readUInt8(cursor);
    cursor += 1;
    if (item === 0x7f) break;
    key = item & 0x1f;
    type = item >> 5;
    reader = entityMetadataReaders[type];
    assert.ok(reader, "missing reader for entity metadata type " + type);
    results = reader(buffer, cursor);
    if (! results) return null;
    metadata[key] = results.value;
    cursor += results.size;
  }
  return {
    value: metadata,
    size: cursor - offset,
  };
}

function readObjectData(buffer, offset) {
  var cursor = offset + 4;
  if (cursor > buffer.length) return null;
  var intField = buffer.readInt32BE(offset);

  if (intField === 0) {
    return {
      value: {
        intField: intField,
      },
      size: cursor - offset,
    };
  }

  if (cursor + 6 > buffer.length) return null;
  var velocityX = buffer.readInt16BE(cursor);
  cursor += 2;
  var velocityY = buffer.readInt16BE(cursor);
  cursor += 2;
  var velocityZ = buffer.readInt16BE(cursor);
  cursor += 2;

  return {
    value: {
      intField: intField,
      velocityX: velocityX,
      velocityY: velocityY,
      velocityZ: velocityZ,
    },
    size: cursor - offset,
  };
}

function readMapChunkBulk (buffer, offset) {
  var cursor = offset + 7;
  if (cursor > buffer.length) return null;
  var chunkCount = buffer.readInt16BE(offset);
  var dataSize = buffer.readInt32BE(offset + 2);
  var skyLightSent = !!buffer.readInt8(offset + 6);

  var cursorEnd = cursor + dataSize + 12 * chunkCount;
  if (cursorEnd > buffer.length) return null;

  var compressedChunkDataEnd = cursor + dataSize;
  var compressedChunkData = buffer.slice(cursor, compressedChunkDataEnd);
  cursor = compressedChunkDataEnd;

  var meta = [];
  var i, chunkX, chunkZ, primaryBitMap, addBitMap;
  for (i = 0; i < chunkCount; ++i) {
    chunkX = buffer.readInt32BE(cursor);
    cursor += 4;
    chunkZ = buffer.readInt32BE(cursor);
    cursor += 4;
    primaryBitMap = buffer.readUInt16BE(cursor);
    cursor += 2;
    addBitMap = buffer.readUInt16BE(cursor);
    cursor += 2;

    meta.push({
      chunkX: chunkX,
      chunkZ: chunkZ,
      primaryBitMap: primaryBitMap,
      addBitMap: addBitMap,
    });
  }

  return {
    value: {
      skyLightSent: skyLightSent,
      compressedChunkData: compressedChunkData,
      meta: meta,
    },
    size: cursorEnd - offset,
  };
}

function readAscii (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;

  var strBegin = offset + results.size;
  var strLen = results.value;
  var strEnd = strBegin + strLen;
  if (strEnd > buffer.length) return null;
  var str = buffer.slice(strBegin, strEnd).toString('ascii');

  return {
    value: str,
    size: strEnd - offset,
  };
}

function readString (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  
  var strBegin = offset + results.size;
  var strLen = results.value;
  var strEnd = strBegin + strLen * 2;
  if (strEnd > buffer.length) return null;
  var str = fromUcs2.convert(buffer.slice(strBegin, strEnd)).toString('utf8');

  return {
    value: str,
    size: strEnd - offset,
  };
}

function readByteArray16 (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;

  var bytesBegin = offset + results.size;
  var bytesSize = results.value;
  var bytesEnd = bytesBegin + bytesSize;
  if (bytesEnd > buffer.length) return null;
  var bytes = buffer.slice(bytesBegin, bytesEnd);

  return {
    value: bytes,
    size: bytesEnd - offset,
  };
}

function readByteArray32(buffer, offset) {
  var results = readInt(buffer, offset);
  if (! results) return null;

  var bytesBegin = offset + results.size;
  var bytesSize = results.value;
  var bytesEnd = bytesBegin + bytesSize;
  if (bytesEnd > buffer.length) return null;
  var bytes = buffer.slice(bytesBegin, bytesEnd);

  return {
    value: bytes,
    size: bytesEnd - offset,
  };
}

function readSlotArray (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var count = results.value;
  var cursor = offset + results.size;

  var slotArray = [];
  for (var i = 0; i < count; ++i) {
    results = readSlot(buffer, cursor);
    if (! results) return null;
    slotArray.push(results.value);
    cursor += results.size;
  }

  return {
    value: slotArray,
    size: cursor - offset,
  };
}

function readShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readUShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readUInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readInt(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readInt32BE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readFloat(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readFloatBE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readDouble(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  var value = buffer.readDoubleBE(offset);
  return {
    value: value,
    size: 8,
  };
}

function readLong(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  var value = buffer.readInt64BE(offset);
  return {
    value: value,
    size: 8,
  };
}

function readByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readUByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readUInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readBool(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: !!value,
    size: 1,
  };
}

function readSlot(buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var blockId = results.value;
  var cursor = offset + results.size;

  if (blockId === -1) {
    return {
      value: { id: blockId },
      size: cursor - offset,
    };
  }

  var cursorEnd = cursor + 5;
  if (cursorEnd > buffer.length) return null;
  var itemCount = buffer.readInt8(cursor);
  var itemDamage = buffer.readInt16BE(cursor + 1);
  var nbtDataSize = buffer.readInt16BE(cursor + 3);
  if (nbtDataSize === -1) nbtDataSize = 0;
  var nbtDataEnd = cursorEnd + nbtDataSize;
  var nbtData = buffer.slice(cursorEnd, nbtDataEnd);

  return {
    value: {
      id: blockId,
      itemCount: itemCount,
      itemDamage: itemDamage,
      nbtData: nbtData,
    },
    size: nbtDataEnd - offset,
  };
}

function SlotWriter(value) {
  this.value = value;
  this.size = value.id === -1 ? 2 : 7 + this.value.nbtData.length;
}

SlotWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.id, offset);
  if (this.value.id === -1) return;
  buffer.writeInt8(this.value.itemCount, offset + 2);
  buffer.writeInt16BE(this.value.itemDamage, offset + 3);
  var nbtDataSize = this.value.nbtData.length;
  if (nbtDataSize === 0) nbtDataSize = -1; // I don't know wtf mojang smokes
  buffer.writeInt16BE(nbtDataSize, offset + 5);
  this.value.nbtData.copy(buffer, offset + 7);
};

function StringWriter(value) {
  this.value = value;
  this.encoded = toUcs2.convert(value);
  this.size = 2 + this.encoded.length;
}

StringWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  this.encoded.copy(buffer, offset + 2);
};

function ByteArray16Writer(value) {
  assert.ok(Buffer.isBuffer(value), "non buffer passed to ByteArray16Writer");
  this.value = value;
  this.size = 2 + value.length;
}

ByteArray16Writer.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  this.value.copy(buffer, offset + 2);
};

function ByteWriter(value) {
  this.value = value;
  this.size = 1;
}

ByteWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value, offset);
}

function BoolWriter(value) {
  this.value = value;
  this.size = 1;
}

BoolWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value ? 1 : 0, offset);
}

function UByteWriter(value) {
  this.value = value;
  this.size = 1;
}

UByteWriter.prototype.write = function(buffer, offset) {
  buffer.writeUInt8(this.value, offset);
};

function FloatWriter(value) {
  this.value = value;
  this.size = 4;
}

FloatWriter.prototype.write = function(buffer, offset) {
  buffer.writeFloatBE(this.value, offset);
}

function DoubleWriter(value) {
  this.value = value;
  this.size = 8;
}

DoubleWriter.prototype.write = function(buffer, offset) {
  buffer.writeDoubleBE(this.value, offset);
}

function ShortWriter(value) {
  this.value = value;
  this.size = 2;
}

ShortWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value, offset);
}

function IntWriter(value) {
  this.value = value;
  this.size = 4;
}

IntWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value, offset);
}

function createPacketBuffer(packetId, params) {
  var size = 1;
  var fields = [ new UByteWriter(packetId) ];
  var packet = packets[packetId];
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    var Writer = writers[fieldInfo.type];
    assert.ok(Writer, "missing writer for data type: " + fieldInfo.type);
    var field = new Writer(value);
    size += field.size;
    fields.push(field);
  });
  var buffer = new Buffer(size);
  var cursor = 0;
  fields.forEach(function(field) {
    field.write(buffer, cursor);
    cursor += field.size;
  });
  return buffer;
}

function parsePacket(buffer) {
  if (buffer.length < 1) return null;
  var packetId = buffer.readUInt8(0);
  var size = 1;
  var results = { id: packetId };
  var packetInfo = packets[packetId];
  assert.ok(packetInfo, "Unrecognized packetId: " + packetId);
  var i, fieldInfo, read, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    read = readers[fieldInfo.type];
    assert.ok(read, "missing reader for data type: " + fieldInfo.type);
    readResults = read(buffer, size);
    if (readResults) {
      results[fieldInfo.name] = readResults.value;
      size += readResults.size;
    } else {
      // buffer needs to be more full
      return null;
    }
  }
  return {
    size: size,
    results: results,
  };
}

function mcPubKeyToURsa(mcPubKeyBuffer) {
  var pem = "-----BEGIN PUBLIC KEY-----\n";
  var base64PubKey = mcPubKeyBuffer.toString('base64');
  var maxLineLength = 65;
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + "\n";
    base64PubKey = base64PubKey.substring(maxLineLength);
  }
  pem += "-----END PUBLIC KEY-----\n";
  return ursa.createPublicKey(pem, 'utf8');
}

function mcHexDigest(hash) {
  var buffer = new Buffer(hash.digest(), 'binary');
  // check for negative hashes
  var negative = buffer.readInt8(0) < 0;
  if (negative) performTwosCompliment(buffer);
  var digest = buffer.toString('hex');
  // trim leading zeroes
  digest = digest.replace(/^0+/g, '');
  if (negative) digest = '-' + digest;
  return digest;

  function performTwosCompliment(buffer) {
    var carry = true;
    var i, newByte, value;
    for (i = buffer.length - 1; i >= 0; --i) {
      value = buffer.readUInt8(i);
      newByte = ~value & 0xff;
      if (carry) {
        carry = newByte === 0xff;
        buffer.writeUInt8(newByte + 1, i);
      } else {
        buffer.writeUInt8(newByte, i);
      }
    }
  }
}

function getLoginSession(email, password, cb) {
  var req = superagent.post("https://login.minecraft.net");
  req.type('form');
  req.send({
    user: email,
    password: password,
    version: packets.meta.sessionVersion,
  });
  req.end(function(err, resp) {
    var myErr;
    if (err) {
      cb(err);
    } else if (resp.serverError) {
      myErr = new Error("login.minecraft.net is broken: " + resp.status);
      myErr.code = 'ELOGIN500';
      cb(myErr);
    } else if (resp.clientError) {
      myErr = new Error("login.minecraft.net rejected request: " + resp.status + " " + resp.text);
      myErr.code = 'ELOGIN400';
      cb(myErr);
    } else {
      var values = resp.text.split(':');
      var session = {
        currentGameVersion: values[0],
        username: values[2],
        id: values[3],
        uid: values[4],
      };
      if (session.id && session.username) {
        cb(null, session);
      } else {
        myErr = new Error("login.minecraft.net rejected request: " + resp.status + " " + resp.text);
        myErr.code = 'ELOGIN400';
        cb(myErr);
      }
    }
  });
}

function hax(packet) {
  // bullshit post-parsing hax that we have to do due to mojang incompetence
  var tmp;
  if (packet.id === 0x0d) {
    // when 0x0d is sent from the server, the Y and the Stance fields are swapped.
    tmp = packet.y;
    packet.y = packet.stance;
    packet.stance = tmp;
  }
}
