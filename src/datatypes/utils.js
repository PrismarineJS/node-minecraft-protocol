var assert = require('assert');

var getField = require("../utils").getField;

module.exports = {
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'bool': [readBool, writeBool, 1],
  'string': [readString, writeString, sizeOfString],
  'buffer': [readBuffer, writeBuffer, sizeOfBuffer],
  'void': [readVoid, writeVoid, 0],
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
