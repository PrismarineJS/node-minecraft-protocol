var evalCondition = require("../utils").evalCondition;

module.exports = {
  'condition': [readCondition, writeCondition, sizeOfCondition]
};

function readCondition(buffer, offset, typeArgs, rootNode) {
  if(!evalCondition(typeArgs, rootNode))
    return {value: null, size: 0};
  return this.read(buffer, offset, typeArgs.type, rootNode);
}

function writeCondition(value, buffer, offset, typeArgs, rootNode) {
  if(!evalCondition(typeArgs, rootNode))
    return offset;

  return this.write(value, buffer, offset, typeArgs.type, rootNode);
}

function sizeOfCondition(value, typeArgs, rootNode) {
  if(!evalCondition(typeArgs, rootNode))
    return 0;

  return this.sizeOf(value, typeArgs.type, rootNode);
}
