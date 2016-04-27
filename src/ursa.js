'use strict';

let ursa;
try {
  ursa = require("ursa");
} catch(e) {
  console.log("You are using a pure-javascript implementation of RSA.");
  console.log("Your performance might be subpar. Please consider installing URSA");
  ursa = require("ursa-purejs");
}
module.exports=ursa;
