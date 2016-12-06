'use strict';

var capture = require('./');
capture.captureExit();

capture.onExit(function () {
  console.log('onExit');
})

process.on('exit', function () {
  console.log('exit');
});
