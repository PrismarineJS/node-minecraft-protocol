var evalCondition = require("../utils").evalCondition;

module.exports = {
  'condition': [readCondition, writeCondition, sizeOfCondition]
};

function readCondition(buffer, offset, typeArgs, rootNode) {
  if(!evalCondition(typeArgs, rootNode))
    return {value: null, size: 0};
  return this.read(buffer, offset, {type: typeArgs.type, typeArgs: typeArgs.typeArgs}, rootNode);
}

function writeCondition(value, buffer, offset, typeArgs, rootNode) {
  if(!evalCondition(typeArgs, rootNode))
    return offset;

  return this.write(value, buffer, offset, {type: typeArgs.type, typeArgs: typeArgs.typeArgs}, rootNode);
}

function sizeOfCondition(value, fieldInfo, rootNode) {
  if(!evalCondition(fieldInfo, rootNode))
    return 0;

  return this.sizeOf(value, fieldInfo, rootNode);
}
