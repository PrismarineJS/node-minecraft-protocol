var assert = require('power-assert');
var expect = require('chai').expect;

var utils = require('../../dist/datatypes/utils');
var getReader = function(dataType) { return dataType[0]; };
var getWriter = function(dataType) { return dataType[1]; };
var getSizeOf = function(dataType) { return dataType[2]; };

describe('Utils', function() {
  describe('.bool', function() {
    it('Reads false value for binary 0', function() {
      assert.deepEqual(getReader(utils.bool)(new Buffer([0]), 0), {value: false, size: 1});
    });
    it('Reads true for every other binary value', function() {
      var buf = new Buffer([0]);
      var i = 1;
      while (i < 256) {
        buf[0] = i++;
        assert.deepEqual(getReader(utils.bool)(buf, 0), {value: true, size: 1});
      }
    });
    it('Writes false', function() {
      var buffer = new Buffer(1);
      getWriter(utils.bool)(false, buffer, 0);
      assert.deepEqual(buffer, new Buffer([0]));
    });
    it('Writes true', function() {
      var buffer = new Buffer(1);
      getWriter(utils.bool)(true, buffer, 0);
      assert.notDeepEqual(buffer, new Buffer([0]));
    });
    it('Has a size of 1', function() {
      assert.equal(typeof getSizeOf(utils.bool), "number");
      assert.equal(getSizeOf(utils.bool), 1);
    });
  });
  describe('.varint', function() {
    it.skip('Has no tests', function() {
    });
  });
  describe('.buffer', function() {
    it.skip('Has no tests', function() {
    });
  });
  describe('.string', function() {
    it.skip('Has no tests', function() {
    });
  });
  describe('.void', function() {
    it.skip('Has no tests', function() {
    });
  });
  describe('.bitfield', function() {
    it('Reads an unsigned 8 bit number', function() {
      var buf = new Buffer([0xff]);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": false }
      ];
      expect(getReader(utils.bitfield)(buf, 0, typeArgs, {})).to.deep.equal({
        value: { "one": 255 },
        size: 1
      });
    });
    it('Reads a signed 8 bit number', function() {
      var buf = new Buffer([0xff]);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": true }
      ];
      expect(getReader(utils.bitfield)(buf, 0, typeArgs, {})).to.deep.equal({
        value: { "one": -1 },
        size: 1
      });
    });
    it('Reads multiple signed 8 bit numbers', function() {
      var buf = new Buffer([0xff, 0x80, 0x12]);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": true },
        { "name": "two", "size": 8, "signed": true },
        { "name": "three", "size": 8, "signed": true }
      ];
      expect(getReader(utils.bitfield)(buf, 0, typeArgs, {})).to.deep.equal({
        value: { "one": -1, "two": -128, "three": 18 },
        size: 3
      });
    });
    it('Reads multiple unsigned 4 bit numbers', function() {
      var buf = new Buffer([0xff, 0x80]);
      var typeArgs = [
        { "name": "one", "size": 4, "signed": false },
        { "name": "two", "size": 4, "signed": false },
        { "name": "three", "size": 4, "signed": false }
      ];
      expect(getReader(utils.bitfield)(buf, 0, typeArgs, {})).to.deep.equal({
        value: { "one": 15, "two": 15, "three": 8 },
        size: 2
      });
    });
    it('Reads multiple signed 4 bit numbers', function() {
      var buf = new Buffer([0xff, 0x80]);
      var typeArgs = [
        { "name": "one", "size": 4, "signed": true },
        { "name": "two", "size": 4, "signed": true },
        { "name": "three", "size": 4, "signed": true }
      ];
      expect(getReader(utils.bitfield)(buf, 0, typeArgs, {})).to.deep.equal({
        value: { "one": -1, "two": -1, "three": -8 },
        size: 2
      });
    });
    it('Reads an unsigned 12 bit number', function() {
      var buf = new Buffer([0xff, 0x80]);
      var typeArgs = [
        { "name": "one", "size": 12, "signed": false }
      ];
      assert.deepEqual(getReader(utils.bitfield)(buf, 0, typeArgs, {}), {
        value: { "one": 4088 },
        size: 2
      });
    });
    it('Reads a complex structure', function() {
      var buf = new Buffer([0x00, 0x00, 0x03, 0x05, 0x30, 0x42, 0xE0, 0x65]);
      var typeArgs = [
        { "name": "x", "size": 26, "signed": true },
        { "name": "y", "size": 12, "signed": true },
        { "name": "z", "size": 26, "signed": true }
      ];
      var value = { x: 12, y: 332, z: 4382821 };
      assert.deepEqual(getReader(utils.bitfield)(buf, 0, typeArgs, {}), {
        value: value,
        size: 8
      });
    });
    it('Writes an unsigned 8 bit number', function() {
      var buf = new Buffer(1);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": false }
      ];
      var value = { "one": 0xff };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 1);
      assert.deepEqual(buf, new Buffer([0xff]));
    });
    it('Writes a signed 8 bit number', function() {
      var buf = new Buffer(1);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": true }
      ];
      var value = { "one": -1 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 1);
      assert.deepEqual(buf, new Buffer([0xff]));
    });
    it('Writes multiple signed 8 bit numbers', function() {
      var buf = new Buffer(3);
      var typeArgs = [
        { "name": "one", "size": 8, "signed": true },
        { "name": "two", "size": 8, "signed": true },
        { "name": "three", "size": 8, "signed": true }
      ];
      var value = { "one": -1, "two": -128, "three": 18 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 3);
      assert.deepEqual(buf, new Buffer([0xff, 0x80, 0x12]));
    });
    it('Writes multiple unsigned 4 bit numbers', function() {
      var buf = new Buffer(2);
      var typeArgs = [
        { "name": "one", "size": 4, "signed": false },
        { "name": "two", "size": 4, "signed": false },
        { "name": "three", "size": 4, "signed": false }
      ];
      var value = { "one": 15, "two": 15, "three": 8 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 2);
      assert.deepEqual(buf, new Buffer([0xff, 0x80]));
    });
    it('Writes multiple signed 4 bit numbers', function() {
      var buf = new Buffer(2);
      var typeArgs = [
        { "name": "one", "size": 4, "signed": true },
        { "name": "two", "size": 4, "signed": true },
        { "name": "three", "size": 4, "signed": true }
      ];
      var value = { "one": -1, "two": -1, "three": -8 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 2);
      assert.deepEqual(buf, new Buffer([0xff, 0x80]));
    });
    it('Writes an unsigned 12 bit number', function() {
      var buf = new Buffer(2);
      var typeArgs = [
        { "name": "one", "size": 12, "signed": false }
      ];
      var value = { "one": 4088 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 2);
      assert.deepEqual(buf, new Buffer([0xff, 0x80]));
    });
    it('Writes a complex structure', function() {
      var buf = new Buffer(8);
      var typeArgs = [
        { "name": "x", "size": 26, "signed": true },
        { "name": "y", "size": 12, "signed": true },
        { "name": "z", "size": 26, "signed": true }
      ];
      var value = { x: 12, y: 332, z: 4382821 };
      assert.equal(getWriter(utils.bitfield)(value, buf, 0, typeArgs, {}), 8);
      assert.deepEqual(buf, new Buffer([0x00, 0x00, 0x03, 0x05, 0x30, 0x42, 0xE0, 0x65]));
    });
  });
});
