var assert = require("assert");

module.exports = {readPackets: readPackets};

function readPackets(packets, states) {
  var packetFields = {};
  var packetNames = {};
  var packetIds = {};
  var packetStates = {toClient: {}, toServer: {}};
  for(var stateName in states) {
    var state = states[stateName];

    packetFields[state] = {toClient: [], toServer: []};
    packetNames[state] = {toClient: [], toServer: []};
    packetIds[state] = {toClient: [], toServer: []};

    ['toClient', 'toServer'].forEach(function(direction) {
      for(var name in packets[state][direction]) {
        var info = packets[state][direction][name];
        var id = parseInt(info.id);
        var fields = info.fields;

        assert(id !== undefined, 'missing id for packet ' + name);
        assert(fields !== undefined, 'missing fields for packet ' + name);
        assert(!packetNames[state][direction].hasOwnProperty(id), 'duplicate packet id ' + id + ' for ' + name);
        assert(!packetIds[state][direction].hasOwnProperty(name), 'duplicate packet name ' + name + ' for ' + id);
        assert(!packetFields[state][direction].hasOwnProperty(name), 'duplicate packet id ' + id + ' for ' + name);
        assert(!packetStates[direction].hasOwnProperty(name), 'duplicate packet name ' + name + ' for ' + id + ', must be unique across all states');

        packetNames[state][direction][id] = name;
        packetIds[state][direction][name] = id;
        packetFields[state][direction][name] = fields;
        packetStates[direction][name] = state;
      }
    });
  }
  return {
    packetFields: packetFields,
    packetNames: packetNames,
    packetIds: packetIds,
    packetStates: packetStates
  };
}
