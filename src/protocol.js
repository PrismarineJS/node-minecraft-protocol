function NMProtocols() {
  this.types = {};
}

NMProtocols.prototype.addType = function(name, functions) {
  this.types[name] = functions;
};

NMProtocols.prototype.addTypes = function(types) {
  var self = this;
  Object.keys(types).forEach(function(name) {
    self.addType(name, types[name]);
  });
};

NMProtocols.prototype.read = function(buffer, cursor, fieldInfo, rootNodes) {
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
};

NMProtocols.prototype.write = function(value, buffer, offset, fieldInfo, rootNode) {
  var type = this.types[fieldInfo.type];
  if(!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  return type[1].call(this, value, buffer, offset, fieldInfo.typeArgs, rootNode);
};

NMProtocols.prototype.sizeOf = function(value, fieldInfo, rootNode) {
  var type = this.types[fieldInfo.type];
  if(!type) {
    throw new Error("missing data type: " + fieldInfo.type);
  }
  if(typeof type[2] === 'function') {
    return type[2].call(this, value, fieldInfo.typeArgs, rootNode);
  } else {
    return type[2];
  }
};



module.exports = NMProtocols;
