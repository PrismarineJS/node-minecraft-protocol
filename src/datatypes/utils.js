var assert = require('assert');

var getField = require("../utils").getField;

module.exports = {
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'bool': [readBool, writeBool, 1],
  'string': [readString, writeString, sizeOfString],
  'buffer': [readBuffer, writeBuffer, sizeOfBuffer],
  'void': [readVoid, writeVoid, 0],
  'bitfield': [readBitField, writeBitField, sizeOfBitField]
};

function readVarInt(buffer, offset) {
  var result = 0;
  var shift = 0;
  var cursor = offset;

  while(true) {
    if(cursor + 1 > buffer.length) return null;
    var b = buffer.readUInt8(cursor);
    result |= ((b & 0x7f) << shift); // Add the bits to our number, except MSB
    cursor++;
    if(!(b & 0x80)) { // If the MSB is not set, we return the number
      return {
        value: result,
        size: cursor - offset
      };
    }
    shift += 7; // we only have 7 bits, MSB being the return-trigger
    assert.ok(shift < 64, "varint is too big"); // Make sure our shift don't overflow.
  }
}

function sizeOfVarInt(value) {
  var cursor = 0;
  while(value & ~0x7F) {
    value >>>= 7;
    cursor++;
  }
  return cursor + 1;
}

function writeVarInt(value, buffer, offset) {
  var cursor = 0;
  while(value & ~0x7F) {
    buffer.writeUInt8((value & 0xFF) | 0x80, offset + cursor);
    cursor++;
    value >>>= 7;
  }
  buffer.writeUInt8(value, offset + cursor);
  return offset + cursor + 1;
}


function readString(buffer, offset) {
  var length = readVarInt(buffer, offset);
  if(!!!length) return null;
  var cursor = offset + length.size;
  var stringLength = length.value;
  var strEnd = cursor + stringLength;
  if(strEnd > buffer.length) return null;

  var value = buffer.toString('utf8', cursor, strEnd);
  cursor = strEnd;

  return {
    value: value,
    size: cursor - offset,
  };
}

function writeString(value, buffer, offset) {
  var length = Buffer.byteLength(value, 'utf8');
  offset = writeVarInt(length, buffer, offset);
  buffer.write(value, offset, length, 'utf8');
  return offset + length;
}


function sizeOfString(value) {
  var length = Buffer.byteLength(value, 'utf8');
  return sizeOfVarInt(length) + length;
}

function readBool(buffer, offset) {
  if(offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: !!value,
    size: 1,
  };
}

function writeBool(value, buffer, offset) {
  buffer.writeInt8(+value, offset);
  return offset + 1;
}


function readBuffer(buffer, offset, typeArgs, rootNode) {
  var size = 0;
  var count;
  if (typeof typeArgs.count !== "undefined")
    count = getField(typeArgs.count, rootNode);
  else if (typeof typeArgs.countType !== "undefined") {
    var countResults = this.read(buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
    size += countResults.size;
    offset += countResults.size;
    count = countResults.value;
  }
  return {
    value: buffer.slice(offset, offset + count),
    size: size + count
  };
}

function writeBuffer(value, buffer, offset, typeArgs, rootNode) {
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    offset = this.write(value.length, buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
  } else if (typeof typeArgs.count === "undefined") { // Broken schema, should probably error out
  }
  value.copy(buffer, offset);
  return offset + value.length;
}

function sizeOfBuffer(value, typeArgs, rootNode) {
  var size = 0;
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    size = this.sizeOf(value.length, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
  }
  return size + value.length;
}

function readVoid() {
  return {
    value: undefined,
    size: 0,
  };
}

function writeVoid(value, buffer, offset) {
  return offset;
}

function generateBitMask(n) {
  return (1 << n) - 1;
}

function readBitField(buffer, offset, typeArgs, context) {
  var beginOffset = offset;
  var curVal = null;
  var bits = 0;
  var results = {};
  results.value = typeArgs.reduce(function(acc, item) {
    var size = item.size;
    var val = 0;
    while (size > 0) {
      if (bits == 0) {
        curVal = buffer[offset++];
        bits = 8;
      }
      var bitsToRead = Math.min(size, bits);
      val = (val << bitsToRead) | (curVal & generateBitMask(bits)) >> (bits - bitsToRead);
      bits -= bitsToRead;
      size -= bitsToRead;
    }
    if (item.signed && val >= 1 << (item.size - 1))
      val -= 1 << item.size;
    acc[item.name] = val;
    return acc;
  }, {});
  results.size = offset - beginOffset;
  return results;
}
function writeBitField(value, buffer, offset, typeArgs, context) {
  var toWrite = 0;
  var bits = 0;
  typeArgs.forEach(function(item) {
    var val = value[item.name];
    var size = item.size;
    var signed = item.signed;
    if ((!item.signed && val < 0) || (item.signed && val < -(1 << (size - 1))))
      throw new Error(value + " < " + item.signed ? (-(1 << (size - 1))) : 0);
    else if ((!item.signed && val >= 1 << size)
        || (item.signed && val >= (1 << (size - 1)) - 1))
      throw new Error(value + " >= " + iteme.signed ? (1 << size) : ((1 << (size - 1)) - 1));
    while (size > 0) {
      var writeBits = Math.min(8 - bits, size);
      toWrite = toWrite << writeBits |
        ((val >> (size - writeBits)) & generateBitMask(writeBits));
      size -= writeBits;
      bits += writeBits;
      if (bits === 8) {
        buffer[offset++] = toWrite;
        bits = 0;
        toWrite = 0;
      }
    }
  });
  if (bits != 0)
    buffer[offset++] = toWrite << (8 - bits);
  return offset;
}

function sizeOfBitField(value, typeArgs, context) {
  return Math.ceil(typeArgs.reduce(function(acc, item) {
    return acc + item.size;
  }, 0) / 8);
}
