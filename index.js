var RSVP = require('rsvp');

var exit;
var handlers = [];
var lastTime;

process.on('beforeExit', function () {
  if (handlers.length === 0) { return; }

  return module.exports._flush();
});

/*
 * To allow cooperative async exit handlers, we unfortunately must hijack
 * process.exit.
 *
 * It allows a handler to ensure exit, without that exit handler impeding other
 * similar handlers
 *
 * for example, see: https://github.com/sindresorhus/ora/issues/27
 *
 */
module.exports.releaseExit = function() {
  if (exit) {
    process.exit = exit;
    exit = null;
  }
};

module.exports.captureExit = function() {
  if (exit) {
    // already captured, no need to do more work
    return;
  }
  exit = process.exit;

  process.exit = function(code) {
    if (handlers.length === 0 && lastTime === undefined) {
      // synchronously exit.
      //
      // We do this brecause either
      //
      //  1.  The process exited due to a call to `process.exit` but we have no
      //      async work to do because no handlers had been attached.  It
      //      doesn't really matter whether we take this branch or not in this
      //      case.
      //
      //  2.  The process exited naturally.  We did our async work during
      //      `beforeExit` and are in this function because someone else has
      //      called `process.exit` during an `on('exit')` hook.  The only way
      //      for us to preserve the exit code in this case is to exit
      //      synchronously.
      //
      return exit.call(process, code);
    }

    var own = lastTime = module.exports._flush(lastTime, code)
      .then(function() {
        // if another chain has started, let it exit
        if (own !== lastTime) { return; }
        exit.call(process, code);
      })
      .catch(function(error) {
        // if another chain has started, let it exit
        if (own !== lastTime) { return; }
        console.error(error);
        exit.call(process, 1);
      });
  };
};

module.exports._handlers = handlers;
module.exports._flush = function(lastTime, code) {
  var work = handlers.splice(0, handlers.length);

  return RSVP.Promise.resolve(lastTime).
    then(function() {
      return RSVP.Promise.all(work.map(function(handler) {
        return handler.call(null, code);
      }));
    });
};

module.exports.onExit = function(cb) {
  if (!exit) {
    throw new Error('Cannot install handler when exit is not captured.  Call `captureExit()` first');
  }
  var index = handlers.indexOf(cb);

  if (index > -1) { return; }
  handlers.push(cb);
};

module.exports.offExit = function(cb) {
  var index = handlers.indexOf(cb);

  if (index < 0) { return; }

  handlers.splice(index, 1);
};

module.exports.exit  = function() {
  exit.apply(process, arguments);
};
