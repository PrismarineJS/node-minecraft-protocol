module.exports={'byte': [readByte, writeByte, 1]};

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
