'use strict';

var capture = require('./');
capture.captureExit();

capture.onExit(function () {
  console.log('onExit');
  process.exit(1);
});

capture.onExit(function () {
  console.log('onExit2');
  process.exit(2);
});

process.on('exit', function () {
  console.log('exit');
});

