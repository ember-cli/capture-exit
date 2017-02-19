'use strict';

// capture-exit-onExit.js
var captureExit = require('./');

var RSVP = require('rsvp');

var interruptHandler;
var promise = RSVP.Promise.resolve().
    then(function() {
      console.log('capturing exit');
      captureExit.captureExit();
      captureExit.onExit(interruptHandler);
    }).
    then(function() {
      console.log('calling process.exit(1)');
      process.exit(1);
    }).
    then(function() {
      console.log('releasing exit');
      captureExit.releaseExit();
    }).
    then(function() {
      console.log('calling process.exit()');
      process.exit();
    });

interruptHandler = function() {
  console.log('interrupt handler running');
  return promise;
};
