var { getField, getFieldInfo } = require('../utils');

module.exports = {
  'switch': [readSwitch, writeSwitch, sizeOfSwitch],
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
