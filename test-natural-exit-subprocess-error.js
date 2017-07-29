'use strict';

var capture = require('./');
capture.captureExit(process);

capture.onExit(function () {
  console.log('onExit');
});

process.on('exit', function () {
  console.log('exit');
  process.exit(1);
});

