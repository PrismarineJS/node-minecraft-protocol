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
  if(typeof typeArgs.count === "object") {
    count = evalCount(typeArgs.count, rootNode);
  }
  else
    count = getField(typeArgs.count, rootNode);
  for(var i = 0; i < count; i++) {
    var readResults = this.read(buffer, offset, {type: typeArgs.type, typeArgs: typeArgs.typeArgs}, rootNode);
    results.size += readResults.size;
    offset += readResults.size;
    results.value.push(readResults.value);
  }
  return results;
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
  for(var index in value) {
    offset = this.write(value[index], buffer, offset, {type: typeArgs.type, typeArgs: typeArgs.typeArgs}, rootNode);
  }
  return offset;
}

function sizeOfArray(value, typeArgs, rootNode) {
  var size = 0;
  for(var index in value) {
    size += this.sizeOf(value[index], {type: typeArgs.type, typeArgs: typeArgs.typeArgs}, rootNode);
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
  for(var index in typeArgs.fields) {
    var readResults = this.read(buffer, offset, typeArgs.fields[index], rootNode);
    if(readResults == null || readResults.value == null) {
      continue;
    }
    results.size += readResults.size;
    offset += readResults.size;
    results.value[typeArgs.fields[index].name] = readResults.value;
  }
  rootNode.this = backupThis;
  return results;
}

function writeContainer(value, buffer, offset, typeArgs, rootNode) {
  var context = value.this ? value.this : value;
  var backupThis = rootNode.this;
  rootNode.this = value;
  for(var index in typeArgs.fields) {
    if(!context.hasOwnProperty(typeArgs.fields[index].name) && typeArgs.fields[index].type != "count" &&
      (typeArgs.fields[index].type != "condition" || evalCondition(typeArgs.fields[index].typeArgs, rootNode))) {
      debug(new Error("Missing Property " + typeArgs.fields[index].name).stack);
      console.log(context);
    }
    offset = this.write(context[typeArgs.fields[index].name], buffer, offset, typeArgs.fields[index], rootNode);
  }
  rootNode.this = backupThis;;
  return offset;
}

function sizeOfContainer(value, typeArgs, rootNode) {
  var size = 0;
  var context = value.this ? value.this : value;
  var backupThis = rootNode.this;
  rootNode.this = value;
  for(var index in typeArgs.fields) {
    size += this.sizeOf(context[typeArgs.fields[index].name], typeArgs.fields[index], rootNode);
  }
  rootNode.this = backupThis;
  return size;
}

function readCount(buffer, offset, typeArgs, rootNode) {
  return this.read(buffer, offset, {type: typeArgs.type}, rootNode);
}

function writeCount(value, buffer, offset, typeArgs, rootNode) {
  // Actually gets the required field, and writes its length. Value is unused.
  // TODO : a bit hackityhack.
  return this.write(getField(typeArgs.countFor, rootNode).length, buffer, offset, {type: typeArgs.type}, rootNode);
}

function sizeOfCount(value, typeArgs, rootNode) {
  // TODO : should I use value or getField().length ?
  return this.sizeOf(getField(typeArgs.countFor, rootNode).length, {type: typeArgs.type}, rootNode);
}
