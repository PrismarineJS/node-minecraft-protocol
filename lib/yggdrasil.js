/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
var superagent = require("superagent");

var loginSrv = "https://authserver.mojang.com";

function getSession(username, password, clientToken, refresh, cb) {
  if (refresh) {
    var accessToken = password;
    superagent.post(loginSrv + "/refresh")
      .type("json")
      .send({
        "accessToken": accessToken,
        "clientToken": clientToken
      })
      .end(function (resp) {
        if (resp.ok) {
          var session = {
            accessToken: resp.body.accessToken,
            clientToken: resp.body.clientToken,
            username: resp.body.selectedProfile.name
          };
          cb(null, session);
        } else {
          var myErr = new Error(resp.body.error);
          myErr.errorMessage = resp.body.errorMessage;
          myErr.cause = resp.body.cause;
          cb(myErr);
        }
      });
  } else {
    superagent.post(loginSrv + "/authenticate")
      .type("json")
      .send({
        "agent": {
          "name": "Minecraft",
          "version": 1
        },
        "username": username,
        "password": password,
        "clientToken": clientToken
      })
      .end(function (resp) {
        if (resp.ok) {
          var session = resp.body;
          session.username = resp.body.selectedProfile.name;
          cb(null, session);
        } else {
          var myErr = new Error(resp.body.error);
          myErr.errorMessage = resp.body.errorMessage;
          myErr.cause = resp.body.cause;
          cb(myErr);
        }
      });
  }
}

function joinServer(username, serverId, accessToken, selectedProfile, cb) {
  superagent.post("https://sessionserver.mojang.com/session/minecraft/join")
    .type("json")
    .send({
      "accessToken": accessToken,
      "selectedProfile": selectedProfile,
      "serverId": serverId
    })
    .end(function(resp) {
      if (resp.ok) {
        cb(null);
      } else {
        var myErr = new Error(resp.body.error);
        myErr.errorMessage = resp.body.errorMessage;
        myErr.cause = resp.body.cause;
        cb(myErr);
      }
    });
}

function validateSession(username, serverId, cb) {
  superagent.get("https://sessionserver.mojang.com/session/minecraft/hasJoined?username=" + username + "&serverId=" + serverId)
    .end(function(resp) {
      console.log(resp.body);
      if (resp.ok) {
        if ("id" in resp.body) {
          cb(null, resp.body.id);          
        } else {
          var myErr = new Error("Failed to verify username!");
          cb(myErr);
        }
      } else {
        var myErr = new Error(resp.body.error);
        myErr.errorMessage = resp.body.errorMessage;
        myErr.cause = resp.body.cause;
        cb(myErr);
      }
    });
}

exports.getSession = getSession;
exports.joinServer = joinServer;
exports.validateSession = validateSession;
exports.generateUUID = require("node-uuid").v4;
exports.loginType = "yggdrasil";