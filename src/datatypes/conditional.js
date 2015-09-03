var { getField, getFieldInfo } = require('../utils');

module.exports = {
  'switch': [readSwitch, writeSwitch, sizeOfSwitch],
  'option': [readOption, writeOption, sizeOfOption],
};

function readSwitch(buffer, offset, typeArgs, rootNode) {
  var compareTo = getField(typeArgs.compareTo, rootNode);
  var fieldInfo;
  if (typeof typeArgs.fields[compareTo] === 'undefined' && typeof typeArgs.default === "undefined")
    throw new Error(compareTo + " has no associated fieldInfo in switch");
  else if (typeof typeArgs.fields[compareTo] === 'undefined')
    fieldInfo = getFieldInfo(typeArgs.default);
  else
    fieldInfo = getFieldInfo(typeArgs.fields[compareTo]);
  return this.read(buffer, offset, fieldInfo, rootNode);
}

function writeSwitch(value, buffer, offset, typeArgs, rootNode) {
  var compareTo = getField(typeArgs.compareTo, rootNode);
  var fieldInfo;
  if (typeof typeArgs.fields[compareTo] === 'undefined' && typeof typeArgs.default === "undefined")
    throw new Error(compareTo + " has no associated fieldInfo in switch");
  else if (typeof typeArgs.fields[compareTo] === 'undefined')
    fieldInfo = getFieldInfo(typeArgs.default);
  else
    fieldInfo = getFieldInfo(typeArgs.fields[compareTo]);
  return this.write(value, buffer, offset, fieldInfo, rootNode);
}

function sizeOfSwitch(value, typeArgs, rootNode) {
  var compareTo = getField(typeArgs.compareTo, rootNode);
  var fieldInfo;
  if (typeof typeArgs.fields[compareTo] === 'undefined' && typeof typeArgs.default === "undefined")
    throw new Error(compareTo + " has no associated fieldInfo in switch");
  else if (typeof typeArgs.fields[compareTo] === 'undefined')
    fieldInfo = getFieldInfo(typeArgs.default);
  else
    fieldInfo = getFieldInfo(typeArgs.fields[compareTo]);
  return this.sizeOf(value, fieldInfo, rootNode);
}

function readOption(buffer, offset, typeArgs, context) {
  var val = buffer.readUInt8(offset++);
  if (val !== 0) {
    var retval = this.read(buffer, offset, typeArgs, context);
    retval.size++;
    return retval;
  } else {
    return {
      size: 1
    };
  }
}

function writeOption(value, buffer, offset, typeArgs, context) {
  if (value != null) {
    buffer.writeUInt8(1, offset++);
    this.write(value, buffer, offset, typeArgs, context);
  } else {
    buffer.writeUInt8(0, offset++);
  }
  return offset;
}

function sizeOfOption(value, typeArgs, context) {
  return value == null ? 1 : this.sizeOf(value, typeArgs, context) + 1;
}
