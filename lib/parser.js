var net = require('net')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , assert = require('assert')
  , Iconv = require('iconv').Iconv
  , packets = require('../packets.json')
  , toUcs2 = new Iconv('UTF-8', 'utf16be')
  , fromUcs2 = new Iconv('utf16be', 'UTF-8')

module.exports = Parser;

function Parser(options) {
  EventEmitter.call(this);
}
util.inherits(Parser, EventEmitter);

Parser.prototype.connect = function(port, host) {
  var self = this;
  self.client = net.connect(port, host, function() {
    self.emit('connect');
  });
  var incomingBuffer = new Buffer(0);
  self.client.on('data', function(data) {
    incomingBuffer = Buffer.concat([incomingBuffer, data]);
    var parsed;
    while (true) {
      parsed = parsePacket(incomingBuffer);
      if (! parsed) break;
      incomingBuffer = incomingBuffer.slice(parsed.size);
      self.emit('packet', parsed.results);
    }
  });

  self.client.on('error', function(err) {
    self.emit('error', err);
  });

  self.client.on('end', function() {
    self.emit('end');
  });
};

Parser.prototype.writePacket = function(packetId, params) {
  var buffer = createPacketBuffer(packetId, params);
  this.client.write(buffer);
};

var writers = {
  'int': IntWriter,
  'byte': ByteWriter,
  'string': StringWriter,
};

var readers = {
  'string': readString,
  'byteArray': readByteArray,
  'short': readShort,
};

function readString (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  
  var strBegin = offset + results.size;
  var strLen = results.value;
  var strEnd = strBegin + strLen * 2;
  if (strEnd > buffer.length) return null;
  var str = fromUcs2.convert(buffer.slice(strBegin, strEnd)).toString();

  return {
    value: str,
    size: strEnd - offset,
  };
}

function readByteArray (buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;

  var bytesBegin = offset + results.size;
  var bytesSize = results.value;
  var bytesEnd = bytesBegin + bytesSize;
  if (bytesEnd > buffer.length) return null;
  var bytes = buffer.slice(bytesBegin, bytesEnd);

  return {
    value: bytes,
    size: bytesEnd - offset,
  };
}

function readShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function StringWriter(value) {
  this.value = value;
  this.encoded = toUcs2.convert(value);
  this.size = 2 + this.encoded.length;
}

StringWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt16BE(this.value.length, offset);
  this.encoded.copy(buffer, offset + 2);
}

function ByteWriter(value) {
  this.value = value;
  this.size = 1;
}

ByteWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt8(this.value, offset);
}

function IntWriter(value) {
  this.value = value;
  this.size = 4;
}

IntWriter.prototype.write = function(buffer, offset) {
  buffer.writeInt32BE(this.value, offset);
}

function createPacketBuffer(packetId, params) {
  var size = 1;
  var fields = [ new ByteWriter(packetId) ];
  var packet = packets[packetId];
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    var field = new writers[fieldInfo.type](value);
    size += field.size;
    fields.push(field);
  });
  var buffer = new Buffer(size);
  var cursor = 0;
  fields.forEach(function(field) {
    field.write(buffer, cursor);
    cursor += field.size;
  });
  return buffer;
}

function parsePacket(buffer) {
  if (buffer.length < 1) return null;
  var packetId = buffer.readUInt8(0);
  var size = 1;
  var results = { id: packetId };
  var packetInfo = packets[packetId];
  assert.ok(packetInfo, "Unrecognized packetId: " + packetId);
  var i, fieldInfo, read, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    read = readers[fieldInfo.type];
    readResults = read(buffer, size);
    if (readResults) {
      results[fieldInfo.name] = readResults.value;
      size += readResults.size;
    } else {
      // buffer needs to be more full
      return null;
    }
  }
  return {
    size: size,
    results: results,
  };
}
