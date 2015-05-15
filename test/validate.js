var assert = require('assert');

var Validator = require('jsonschema').Validator;
var v = new Validator();

Error.stackTraceLimit = 0;

describe("protocol schema", function() {
  this.timeout(60 * 1000);
  it("protocol.json is valid", function() {
    var instance = require('../protocol/protocol.json');
    var schema = require('../protocol/protocol_schema.json');
    var result = v.validate(instance, schema);
    assert.strictEqual(result.errors.length, 0, require('util').inspect(result.errors, {'depth': 4}));
  });
});
