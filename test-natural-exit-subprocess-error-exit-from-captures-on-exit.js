'use strict';

var capture = require('./');
capture.captureExit(process);

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

