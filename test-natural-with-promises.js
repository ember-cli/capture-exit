'use strict';

var RSVP = require('rsvp');

var capture = require('./');
capture.captureExit();

capture.onExit(function () {
  console.log('resolved-exit')
  return handler({
    timeout: 10
  });
})

capture.onExit(function () {
  console.log('exceptional-exit')
  return handler({
    code: 404,
    timeout: 3
  });
})

capture.onExit(function () {
  console.log('rejected-exit')
  return handler({
    code: 503,
    timeout: 20
  });
})

process.exit();

function handler({ code, timeout }) {
  if (!timeout) {
    if (code) {
      throw new Error(code);
    }

    return;
  }

  return new RSVP.Promise(function(resolve, reject) {
    setTimeout(function() {
      if (!code) {
        resolve();
      } else {
        reject(code);
      }
    }, timeout);
  });
}

