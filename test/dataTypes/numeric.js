var expect = require('chai').expect;

var numeric = require('../../dist/datatypes/numeric');
var getReader = function(dataType) { return dataType[0]; };
var getWriter = function(dataType) { return dataType[1]; };
var getSizeOf = function(dataType) { return dataType[2]; };
/*var getReader = require('../../lib/utils').getReader;
var getWriter = require('../../lib/utils').getWriter;
var getSizeOf = require('../../lib/utils').getSizeOf;*/

var testData = {
  'byte': {
    'readPos': {
      'buffer': new Buffer([0x3d]),
      'value': 61
    },
    'readNeg': {
      'buffer': new Buffer([0x86]),
      'value': -122
    },
    'writePos': {
      'buffer': new Buffer([0x00]),
      'value': 32,
      'bufferAfter': new Buffer([0x20])
    },
    'writeNeg': {
      'buffer': new Buffer([0x00]),
      'value': -122,
      'bufferAfter': new Buffer([0x86])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 1,
    }
  },
  'ubyte': {
    'readPos': {
      'buffer': new Buffer([0x3d]),
      'value': 61
    },
    'readNeg': {
      'buffer': new Buffer([0x86]),
      'value': 134
    },
    'writePos': {
      'buffer': new Buffer([0x00]),
      'value': 61,
      'bufferAfter': new Buffer([0x3d])
    },
    'writeNeg': {
      'buffer': new Buffer([0x00]),
      'value': 134,
      'bufferAfter': new Buffer([0x86])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 1,
    }
  },
  'short': {
    'readPos': {
      'buffer': new Buffer([0x30, 0x87]),
      'value': 12423
    },
    'readNeg': {
      'buffer': new Buffer([0xef, 0x77]),
      'value': -4233
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00]),
      'value': 12423,
      'bufferAfter': new Buffer([0x30, 0x87]),
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00]),
      'value': -4233,
      'bufferAfter': new Buffer([0xef, 0x77])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 2,
    }
  },
  'ushort': {
    'readPos': {
      'buffer': new Buffer([0x30, 0x87]),
      'value': 12423
    },
    'readNeg': {
      'buffer': new Buffer([0xef, 0x77]),
      'value': 61303
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00]),
      'value': 12423,
      'bufferAfter': new Buffer([0x30, 0x87]),
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00]),
      'value': 61303,
      'bufferAfter': new Buffer([0xef, 0x77])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 2,
    }
  },
  'int': {
    'readPos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0xea]),
      'value': 234
    },
    'readNeg': {
      'buffer': new Buffer([0xff, 0xff, 0xfc, 0x00]),
      'value': -1024
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': 234,
      'bufferAfter': new Buffer([0x00, 0x00, 0x00, 0xea])
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': -1024,
      'bufferAfter': new Buffer([0xff, 0xff, 0xfc, 0x00])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 4
    }
  },
  'uint': {
    'readPos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0xea]),
      'value': 234
    },
    'readNeg': {
      'buffer': new Buffer([0xff, 0xff, 0xfc, 0x00]),
      'value': 4294966272
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': 234,
      'bufferAfter': new Buffer([0x00, 0x00, 0x00, 0xea])
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': 4294966272,
      'bufferAfter': new Buffer([0xff, 0xff, 0xfc, 0x00])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 4
    }
  },
  'float': {
    'readPos': {
      'buffer': new Buffer([0x47, 0x05, 0xc3, 0x00]),
      'value': 34243
    },
    'readNeg': {
      'buffer': new Buffer([0xc6, 0x42, 0x4c, 0x00]),
      'value': -12435
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': 34243,
      'bufferAfter': new Buffer([0x47, 0x05, 0xc3, 0x00])
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00]),
      'value': -12435,
      'bufferAfter': new Buffer([0xc6, 0x42, 0x4c, 0x00])
    },
    'sizeof': {
      'value': 0x2d,
      'size': 4
    }
  },
  'double': {
    'readPos': {
      'buffer': new Buffer([0x40, 0xe0, 0xb8, 0x60, 0x00, 0x00, 0x00, 0x00]),
      'value': 34243
    },
    'readNeg': {
      'buffer': new Buffer([0xc0, 0xc8, 0x49, 0x80, 0x00, 0x00, 0x00, 0x00]),
      'value': -12435
    },
    'writePos': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      'value': 34243,
      'bufferAfter': new Buffer([0x40, 0xe0, 0xb8, 0x60, 0x00, 0x00, 0x00, 0x00]),
    },
    'writeNeg': {
      'buffer': new Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      'value': -12435,
      'bufferAfter': new Buffer([0xc0, 0xc8, 0x49, 0x80, 0x00, 0x00, 0x00, 0x00]),
    },
    'sizeof': {
      'value': 0x2d,
      'size': 8
    }
  }
};

describe('Numeric', function() {
  for (var key in testData) {
    if (testData.hasOwnProperty(key) && numeric.hasOwnProperty(key)) {
      var value = testData[key];
      describe('.' + key, function() {
        var reader;
        var writer;
        var sizeof;
        before(function() {
          reader = getReader(numeric[key]);
          writer = getWriter(numeric[key]);
          sizeof = getSizeOf(numeric[key]);
        });
        it('Returns null if not enough data is provided', function() {
          expect(reader(new Buffer(0), 0)).to.eql(null);
        });
        it('Reads positive values', function() {
          expect(reader(value.readPos.buffer, 0).value).to.deep.eql(value.readPos.value);
        });
        it('Reads big/negative values', function() {
          expect(reader(value.readNeg.buffer, 0).value).to.deep.eql(value.readNeg.value);
        });
        it('Writes positive values', function() {
          writer(value.writePos.value, value.writePos.buffer, 0);
          expect(value.writePos.buffer).to.deep.eql(value.writePos.bufferAfter);
        });
        it('Writes negative values', function() {
          writer(value.writeNeg.value, value.writeNeg.buffer, 0);
          expect(value.writeNeg.buffer).to.deep.eql(value.writeNeg.bufferAfter);
        });
        it('Calculates size', function() {
          var size;
          if (typeof sizeof === "function") {
            size = sizeof(value.sizeof.value);
          } else {
            size = sizeof;
          }
          expect(size).to.eql(value.sizeof.size);
        });
      });
    }
  }
});
