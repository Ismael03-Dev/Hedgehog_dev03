"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function(defaultFuncs, api, ctx) {
  return function editMessage(message, messageID, callback) {
    var resolveFunc = function(){};
    var rejectFunc = function(){};
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (!messageID) {
      return callback({ error: "messageID is required" });
    }

    if (typeof message === "object") {
      if (message.body) message = message.body;
      else return callback({ error: "Message body is required" });
    }

    const form = {
      message_text: message,
      message_id: messageID
    };

    defaultFuncs
      .post("https://www.facebook.com/messages/edit_message/", ctx.jar, form, ctx.globalOptions)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function(resData) {
        if (resData.error) throw resData;
        return callback(null, resData);
      })
      .catch(function(err) {
        log.error("editMessage", err);
        return callback(err);
      });

    return returnPromise;
  };
};