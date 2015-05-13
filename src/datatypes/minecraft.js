var nbt = require('prismarine-nbt');
var utils = require("./utils");
var numeric = require("./numeric");

module.exports = {
    'UUID': [readUUID, writeUUID, 16],
    'position': [readPosition, writePosition, 8],
    'slot': [readSlot, writeSlot, sizeOfSlot],
    'nbt': [readNbt, utils.buffer[1], utils.buffer[2]]
};

function readUUID(buffer, offset) {
    return {
        value: [
            buffer.readUInt32BE(offset),
            buffer.readUInt32BE(offset + 4),
            buffer.readUInt32BE(offset + 8),
            buffer.readUInt32BE(offset + 12),
        ],
        size: 16,
    };
}

function writeUUID(value, buffer, offset) {
    buffer.writeUInt32BE(value[0], offset);
    buffer.writeUInt32BE(value[1], offset + 4);
    buffer.writeUInt32BE(value[2], offset + 8);
    buffer.writeUInt32BE(value[3], offset + 12);
    return offset + 16;
}


function readPosition(buffer, offset) {
    var longVal = numeric.long[0](buffer, offset).value;
    var x = signExtend26(longVal[0] >> 6);
    var y = signExtend12(((longVal[0] & 0x3f) << 6) | ((longVal[1] >> 26) & 0x3f));
    var z = signExtend26(longVal[1] & 0x3FFFFFF);
    return {
        value: { x: x, y: y, z: z },
        size: 8
    };
}
function signExtend26(value) {
    if (value > 0x2000000) value -= 0x4000000;
    return value;
}
function signExtend12(value) {
    if (value > 0x800) value -= 0x1000;
    return value;
}


function writePosition(value, buffer, offset) {
    var longVal = [];
    longVal[0] = ((value.x & 0x3FFFFFF) <<  6) | ((value.y & 0xFFF) >> 6);
    longVal[1] = ((value.y & 0x3F) << 26) | (value.z & 0x3FFFFFF);
    return numeric.long[1](longVal, buffer, offset);
}


function readSlot(buffer, offset) {
    var value = {};
    var results = numeric.short[0](buffer, offset);
    if (! results) return null;
    value.blockId = results.value;

    if (value.blockId === -1) {
        return {
            value: value,
            size: 2,
        };
    }

    var cursorEnd = offset + 6;
    if (cursorEnd > buffer.length) return null;
    value.itemCount = buffer.readInt8(offset + 2);
    value.itemDamage = buffer.readInt16BE(offset + 3);
    var nbtData = buffer.readInt8(offset + 5);
    if (nbtData == 0) {
        return {
            value: value,
            size: 6
        }
    }
    var nbtData = readNbt(buffer, offset + 5);
    value.nbtData = nbtData.value;
    return {
        value: value,
        size: nbtData.size + 5
    };
}

function writeSlot(value, buffer, offset) {
    buffer.writeInt16BE(value.blockId, offset);
    if (value.blockId === -1) return offset + 2;
    buffer.writeInt8(value.itemCount, offset + 2);
    buffer.writeInt16BE(value.itemDamage, offset + 3);
    var nbtDataLen;
    if (value.nbtData)
    {
        var newbuf = nbt.writeUncompressed(value.nbtData);
        newbuf.copy(buffer, offset + 5);
        nbtDataLen = newbuf.length;
    }
    else
    {
        buffer.writeInt8(0, offset + 5);
        nbtDataLen = 1;
    }
    return offset + 5 + nbtDataLen;
}

function sizeOfSlot(value) {
    if (value.blockId === -1)
        return (2);
    else if (!value.nbtData) {
        return (6);
    } else {
        return (5 + sizeOfNbt(value.nbtData));
    }
}


function readNbt(buffer, offset) {
    buffer = buffer.slice(offset);
    return nbt.parseUncompressed(buffer);
}

function writeNbt(value, buffer, offset) {
    var newbuf = nbt.writeUncompressed(value);
    newbuf.copy(buffer, offset);
    return offset + newbuf.length;
}

function sizeOfNbt(value) {
    return nbt.writeUncompressed(value).length;
}

