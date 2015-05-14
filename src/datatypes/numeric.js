module.exports={
    'byte': [readByte, writeByte, 1],
    'ubyte': [readUByte, writeUByte, 1],
    'short': [readShort, writeShort, 2],
    'ushort': [readUShort, writeUShort, 2],
    'int': [readInt, writeInt, 4],
    'long': [readLong, writeLong, 8],
    'float': [readFloat, writeFloat, 4],
    'double': [readDouble, writeDouble, 8]
};

function readByte(buffer, offset) {
    if (offset + 1 > buffer.length) return null;
    var value = buffer.readInt8(offset);
    return {
        value: value,
        size: 1,
    };
}

function writeByte(value, buffer, offset) {
    buffer.writeInt8(value, offset);
    return offset + 1;
}

function readUByte(buffer, offset) {
    if (offset + 1 > buffer.length) return null;
    var value = buffer.readUInt8(offset);
    return {
        value: value,
        size: 1,
    };
}

function writeUByte(value, buffer, offset) {
    buffer.writeUInt8(value, offset);
    return offset + 1;
}

function readFloat(buffer, offset) {
    if (offset + 4 > buffer.length) return null;
    var value = buffer.readFloatBE(offset);
    return {
        value: value,
        size: 4,
    };
}

function writeFloat(value, buffer, offset) {
    buffer.writeFloatBE(value, offset);
    return offset + 4;
}

function readDouble(buffer, offset) {
    if (offset + 8 > buffer.length) return null;
    var value = buffer.readDoubleBE(offset);
    return {
        value: value,
        size: 8,
    };
}

function writeDouble(value, buffer, offset) {
    buffer.writeDoubleBE(value, offset);
    return offset + 8;
}


function readShort(buffer, offset) {
    if (offset + 2 > buffer.length) return null;
    var value = buffer.readInt16BE(offset);
    return {
        value: value,
        size: 2,
    };
}
function writeShort(value, buffer, offset) {
    buffer.writeInt16BE(value, offset);
    return offset + 2;
}

function readUShort(buffer, offset) {
    if (offset + 2 > buffer.length) return null;
    var value = buffer.readUInt16BE(offset);
    return {
        value: value,
        size: 2,
    };
}

function writeUShort(value, buffer, offset) {
    buffer.writeUInt16BE(value, offset);
    return offset + 2;
}

function readInt(buffer, offset) {
    if (offset + 4 > buffer.length) return null;
    var value = buffer.readInt32BE(offset);
    return {
        value: value,
        size: 4,
    };
}

function writeInt(value, buffer, offset) {
    buffer.writeInt32BE(value, offset);
    return offset + 4;
}


function readLong(buffer, offset) {
    if (offset + 8 > buffer.length) return null;
    return {
        value: [buffer.readInt32BE(offset), buffer.readInt32BE(offset + 4)],
        size: 8,
    };
}

function writeLong(value, buffer, offset) {
    buffer.writeInt32BE(value[0], offset);
    buffer.writeInt32BE(value[1], offset + 4);
    return offset + 8;
}




