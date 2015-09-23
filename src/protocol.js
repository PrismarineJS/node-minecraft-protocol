var { getFieldInfo } = require('./utils');
var reduce = require('lodash.reduce');

function isFieldInfo(type) {
  return typeof type === "string"
    || (Array.isArray(type) && typeof type[0] === "string")
    || type.type;
}

function findArgs(acc, v, k) {
  if (typeof v === "string" && v.charAt(0) === '$')
    acc.push({ "path": k, "val": v.substr(1) });
  else if (Array.isArray(v) || typeof v === "object")
    acc = acc.concat(reduce(v, findArgs, []).map((v) => ({ "path": k + "." + v.path, "val": v.val })));
  return acc;
}


function setField(path, val, into) {
  var c = path.split('.').reverse();
  while (c.length > 1) {
    into = into[c.pop()];
  }
  into[c.pop()] = val;
}

function extendType(functions, defaultTypeArgs) {
  var argPos = reduce(defaultTypeArgs, findArgs, []);
  return [function read(buffer, offset, typeArgs, context) {
    var args = JSON.parse(JSON.stringify(defaultTypeArgs));
    argPos.forEach((v) => {
      setField(v.path, typeArgs[v.val], args);
    });
    return functions[0].call(this, buffer, offset, args, context);
  }, function write(value, buffer, offset, typeArgs, context) {
    var args = JSON.parse(JSON.stringify(defaultTypeArgs));
    argPos.forEach((v) => {
      setField(v.path, typeArgs[v.val], args);
    });
    return functions[1].call(this, value, buffer, offset, args, context);
  }, function sizeOf(value, typeArgs, context) {
    var args = JSON.parse(JSON.stringify(defaultTypeArgs));
    argPos.forEach((v) => {
      setField(v.path, typeArgs[v.val], args);
    });
    if (typeof functions[2] === "function")
      return functions[2].call(this, value, args, context);
    else
      return functions[2];
  }];
}

class NMProtocols
{
  types={};

  constructor() {

  }

  addType(name, functions) {
    if (functions === "native")
      return;
    else if (isFieldInfo(functions)) {
      var fieldInfo = getFieldInfo(functions);
      this.types[name] = extendType(this.types[fieldInfo.type], fieldInfo.typeArgs);
    }
    else
      this.types[name] = functions;
  }

  addTypes(types) {
    var self = this;
    Object.keys(types).forEach(function(name) {
      self.addType(name, types[name]);
    });
  }

  read(buffer, cursor, _fieldInfo, rootNodes) {
    let fieldInfo = getFieldInfo(_fieldInfo);
    var type = this.types[fieldInfo.type];
    if(!type) {
      return {
        error: new Error("missing data type: " + fieldInfo.type)
      };
    }
    var readResults = type[0].call(this, buffer, cursor, fieldInfo.typeArgs, rootNodes);
    if(readResults == null) {
      throw new Error("Reader returned null : " + JSON.stringify(fieldInfo));
    }
    if(readResults && readResults.error) return {error: readResults.error};
    return readResults;
  }

  write(value, buffer, offset, _fieldInfo, rootNode) {
    let fieldInfo = getFieldInfo(_fieldInfo);
    var type = this.types[fieldInfo.type];
    if(!type) {
      return {
        error: new Error("missing data type: " + fieldInfo.type)
      };
    }
    return type[1].call(this, value, buffer, offset, fieldInfo.typeArgs, rootNode);
  }

  sizeOf(value, _fieldInfo, rootNode) {
    let fieldInfo = getFieldInfo(_fieldInfo);
    var type = this.types[fieldInfo.type];
    if(!type) {
      throw new Error("missing data type: " + fieldInfo.type);
    }
    if(typeof type[2] === 'function') {
      return type[2].call(this, value, fieldInfo.typeArgs, rootNode);
    } else {
      return type[2];
    }
  }
}

module.exports = NMProtocols;
