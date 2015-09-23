var { getField, tryCatch, addErrorField } = require("../utils");
var debug = require("../debug");

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
    var countResults;
    tryCatch(() => {
      countResults = this.read(buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
    }, (e) => {
      addErrorField(e, "$count");
      throw e;
    });
    results.size += countResults.size;
    offset += countResults.size;
    count = countResults.value;
  } else // TODO : broken schema, should probably error out.
    count = 0;
  for(var i = 0; i < count; i++) {
    var readResults;
    tryCatch(() => {
      readResults = this.read(buffer, offset, typeArgs.type, rootNode);
    }, (e) => {
      addErrorField(e, i);
      throw e;
    });
    results.size += readResults.size;
    offset += readResults.size;
    results.value.push(readResults.value);
  }
  return results;
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    tryCatch(() => {
      offset = this.write(value.length, buffer, offset, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
    }, (e) => {
      addErrorField(e, "$count");
      throw e;
    });
  } else if (typeof typeArgs.count === "undefined") { // Broken schema, should probably error out
  }
  for(var index in value) {
    tryCatch(() => {
      offset = this.write(value[index], buffer, offset, typeArgs.type, rootNode);
    }, (e) => {
      addErrorField(e, index);
      throw e;
    });
  }
  return offset;
}

function sizeOfArray(value, typeArgs, rootNode) {
  var size = 0;
  if (typeof typeArgs.count === "undefined" &&
      typeof typeArgs.countType !== "undefined") {
    tryCatch(() => {
      size = this.sizeOf(value.length, { type: typeArgs.countType, typeArgs: typeArgs.countTypeArgs }, rootNode);
    }, (e) => {
      addErrorField(e, "$count");
      throw e;
    });
  }
  for(var index in value) {
    tryCatch(() => {
      size += this.sizeOf(value[index], typeArgs.type, rootNode);
    }, (e) => {
      addErrorField(e, index);
      throw e;
    });
  }
  return size;
}


function readContainer(buffer, offset, typeArgs, context) {
  var results = {
    value: { "..": context },
    size: 0
  };
  typeArgs.forEach((typeArg) => {
    tryCatch(() => {
      var readResults = this.read(buffer, offset, typeArg.type, results.value);
      results.size += readResults.size;
      offset += readResults.size;
      if (typeArg.anon) {
        Object.keys(readResults.value).forEach(function(key) {
          results.value[key] = readResults.value[key];
        });
      } else
        results.value[typeArg.name] = readResults.value;
    }, (e) => {
      if (typeArgs && typeArg && typeArg.name)
        addErrorField(e, typeArg.name);
      else
        addErrorField(e, "unknown");
      throw e;
    });
  });
  delete results.value[".."];
  return results;
}

function writeContainer(value, buffer, offset, typeArgs, context) {
  value[".."] = context;
  typeArgs.forEach((typeArg) => {
    tryCatch(() => {
      if (typeArg.anon)
        offset = this.write(value, buffer, offset, typeArg.type, value);
      else
        offset = this.write(value[typeArg.name], buffer, offset, typeArg.type, value);
    }, (e) => {
      if (typeArgs && typeArg && typeArg.name)
        addErrorField(e, typeArg.name);
      else
        addErrorField(e, "unknown");
      throw e;
    });
  });
  delete value[".."];
  return offset;
}

function sizeOfContainer(value, typeArgs, context) {
  value[".."] = context;
  var size = 0;
  typeArgs.forEach((typeArg) => {
    tryCatch(() => {
      if (typeArg.anon)
        size += this.sizeOf(value, typeArg.type, value);
      else
        size += this.sizeOf(value[typeArg.name], typeArg.type, value);
    }, (e) => {
      if (typeArgs && typeArg && typeArg.name)
        addErrorField(e, typeArg.name);
      else
        addErrorField(e, "unknown");
      throw e;
    });
  });
  delete value[".."];
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
