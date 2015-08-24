var getField = require("../utils").getField;
var debug = require("../debug");
var evalCondition = require("../utils").evalCondition;

module.exports = {
  'array': [readArray, writeArray, sizeOfArray],
  'count': [readCount, writeCount, sizeOfCount],
  'container': [readContainer, writeContainer, sizeOfContainer]
};


function evalCount(count, fields) {
  if(fields[count["field"]] in count["map"])
    return count["map"][fields[count["field"]]];
  return count["default"];
}

function readArray(buffer, offset, typeArgs, rootNode) {
  var results = {
    value: [],
    size: 0
  };
  var count;
  if(typeof typeArgs.count === "object")
    count = evalCount(typeArgs.count, rootNode);
  else if (typeof typeArgs.count !== "undefined")
    count = getField(typeArgs.count, rootNode);
  else if (typeof typeArgs.countType !== "undefined") {
    var countResults = this.read(buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
    results.size += countResults.size;
    offset += countResults.size;
    count = countResults.value;
  } else // TODO : broken schema, should probably error out.
    count = 0;
  for(var i = 0; i < count; i++) {
    var readResults = this.read(buffer, offset, typeArgs.type, rootNode);
    results.size += readResults.size;
    offset += readResults.size;
    results.value.push(readResults.value);
  }
  return results;
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    offset = this.write(value.length, buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
  } else if (typeof typeArgs.count === "undefined") { // Broken schema, should probably error out
  }
  for(var index in value) {
    offset = this.write(value[index], buffer, offset, typeArgs.type, rootNode);
  }
  return offset;
}

function sizeOfArray(value, typeArgs, rootNode) {
  var size = 0;
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    size = this.sizeOf(value.length, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
  }
  for(var index in value) {
    size += this.sizeOf(value[index], typeArgs.type, rootNode);
  }
  return size;
}


function readContainer(buffer, offset, typeArgs, rootNode) {
  var results = {
    value: {},
    size: 0
  };
  // BLEIGH. Huge hack because I have no way of knowing my current name.
  // TODO : either pass fieldInfo instead of typeArgs as argument (bleigh), or send name as argument (verybleigh).
  // TODO : what I do inside of roblabla/Protocols is have each "frame" create a new empty slate with just a "super" object pointing to the parent.
  var backupThis = rootNode.this;
  rootNode.this = results.value;
  for(var index in typeArgs) {
    var readResults = this.read(buffer, offset, typeArgs[index].type, rootNode);
    if(readResults == null || readResults.value == null) {
      continue;
    }
    results.size += readResults.size;
    offset += readResults.size;
    results.value[typeArgs[index].name] = readResults.value;
  }
  rootNode.this = backupThis;
  return results;
}

function writeContainer(value, buffer, offset, typeArgs, rootNode) {
  var backupThis = rootNode.this;
  rootNode.this = value;
  for(var index in typeArgs) {
    offset = this.write(value[typeArgs[index].name], buffer, offset, typeArgs[index].type, rootNode);
  }
  rootNode.this = backupThis;
  return offset;
}

function sizeOfContainer(value, typeArgs, rootNode) {
  var size = 0;
  var backupThis = rootNode.this;
  rootNode.this = value;
  for(var index in typeArgs) {
    size += this.sizeOf(value[typeArgs[index].name], typeArgs[index].type, rootNode);
  }
  rootNode.this = backupThis;
  return size;
}

function readCount(buffer, offset, typeArgs, rootNode) {
  return this.read(buffer, offset, typeArgs.type, rootNode);
}

function writeCount(value, buffer, offset, typeArgs, rootNode) {
  // Actually gets the required field, and writes its length. Value is unused.
  // TODO : a bit hackityhack.
  return this.write(getField(typeArgs.countFor, rootNode).length, buffer, offset, typeArgs.type, rootNode);
}

function sizeOfCount(value, typeArgs, rootNode) {
  // TODO : should I use value or getField().length ?
  return this.sizeOf(getField(typeArgs.countFor, rootNode).length, typeArgs.type, rootNode);
}
