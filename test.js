var expect = require('chai').expect;
var RSVP = require('rsvp');

var originalExit = process.exit; // keep this around for good measure.
var exit = require('./');
var childProcess = require('child_process');
var execa = require('execa');
var error = console.error;
describe('capture-exit', function() {
  beforeEach(function() {
    expect(process.exit, 'ensure we start in a correct state').to.equal(originalExit);
  });

  afterEach(function() {
    console.error = error; // always restore;
    // always restore, in case we have bugs in our code while developing
    exit._reset();
    process.exit = originalExit;
  });

  describe('.releaseExit', function() {
    it('does nothing if no exit has yet been captured', function() {
      exit.releaseExit();
      expect(process.exit, 'ensure we remain in a correct state').to.equal(originalExit);
    });

    it('restores the original exit', function() {
      exit.captureExit();
      expect(process.exit, 'ensure we have captured exit').to.not.equal(originalExit);
      exit.releaseExit();
      expect(process.exit, 'ensure we remain in a correct state').to.equal(originalExit);
      exit.releaseExit();
      expect(process.exit, 'ensure we still remain in a correct state').to.equal(originalExit);
    });

    it('does not release exit while exiting', function() {
      exit.captureExit();
      expect(process.exit, 'precond - ensure we have captured exit').to.not.equal(originalExit);

      return exit._flush()
        .then(function() {
          exit.releaseExit();
          expect(process.exit, 'ensure we have captured exit').to.not.equal(originalExit);
        });
    });

    it('does not allow loosing prior exit codes while flushing', function() {
      var succeeded = false;
      try {
        var output = childProcess.execSync('node test-release-exit-after-process-exit.js');
        succeeded = true;
      } catch(e) {
        expect(e.output+'').to.include('capturing exit');
        expect(e.output+'').to.include('calling process.exit(1)');
        expect(e.output+'').to.include('releasing exit');
        expect(e.output+'').to.include('calling process.exit()');
      }

      if (succeeded) {
        throw new Error('Unexpected zero exit status for process.exit(1)');
      }
    });
  });

  describe('.captureExit', function() {
    it('replace existing exit', function() {
      exit.captureExit();
      expect(process.exit, 'ensure we have replaced').to.not.equal(originalExit);
    });

    it('replace existing but foreign exit', function() {
      var differentExit = process.exit = function() { };
      exit.captureExit();
      expect(process.exit, 'ensure we have replaced').to.not.equal(originalExit);
      expect(process.exit, 'ensure we have replaced').to.not.equal(differentExit);
      exit.releaseExit();
      expect(process.exit, 'we have correctly restored the right exit').to.equal(differentExit);
    });

    describe('integration', function() {
      it('works (simply)', function() {
        var exitWasCalled = 0;
        var onExitWasCalled = 0;
        process.exit = function stubExit(code) {
          exitWasCalled++;
          expect(code).to.equal('the expected code');
        };

        var deferred;
        exit.captureExit();
        exit.onExit(function() {
          onExitWasCalled++;
          deferred = RSVP.defer();
          return deferred.promise;
        });

        process.exit('the expected code');

        expect(exitWasCalled).to.equal(0);
        expect(onExitWasCalled).to.equal(0);

        return delay(100).then(function() {
          deferred.resolve();

          return deferred.promise.then(function() {
            expect(onExitWasCalled).to.equal(1);
          });
        }).finally(function() {
          expect(onExitWasCalled).to.equal(1);
        });
      });

      it('works (multiple exits)', function() {
        var exitWasCalled = 0;
        var onExitWasCalled = 0;
        var deferred;
        var lastDeferred = RSVP.defer();

        process.exit = function stubExit(code) {
          exitWasCalled++;

          try {
            expect(code).to.equal('the expected code');
            lastDeferred.resolve();
          } catch(e) {
            lastDeferred.reject(e);
          }

        };

        exit.captureExit();
        exit.onExit(function(code) {
          onExitWasCalled++;
          deferred = RSVP.defer();
          expect(code).to.equal('the expected code');
          return deferred.promise;
        });

        process.exit('the expected code');
        process.exit('NOT the expected code');

        expect(exitWasCalled).to.equal(0);
        expect(onExitWasCalled).to.equal(0);

        return delay(100).then(function() {
          deferred.resolve();

          return deferred.promise.then(function() {
            expect(onExitWasCalled).to.equal(1);
          });
        }).finally(function() {
          expect(onExitWasCalled).to.equal(1);

          return lastDeferred.promise;
        });
      });

      it('exits with 1 if a prior exit handler throws', function() {
        var deferred;
        var lastDeferred = RSVP.defer();
        var exitWasCalled = 0;
        var onExitWasCalled = 0;

        process.exit = function stubExit(code) {
          exitWasCalled++;

          try {
            expect(code).to.equal(1);
            lastDeferred.resolve();
          } catch(e) {
            lastDeferred.reject(e);
          }
        };

        var didConsoleError = 0;
        var badThingsAreBad = new Error('bad things are bad');
        console.error = function(theError) {
          didConsoleError++;
          expect(theError).to.equal(badThingsAreBad);
        };

        exit.captureExit();
        exit.onExit(function(code) {
          onExitWasCalled++;
          deferred = RSVP.defer();
          throw badThingsAreBad;
        });

        process.exit('NOT the expected code');
        process.exit('NOT the expected code');

        expect(exitWasCalled).to.equal(0);
        expect(onExitWasCalled).to.equal(0);

        return delay(100).then(function() {
          expect(didConsoleError).to.eql(1);
          deferred.resolve();

          return deferred.promise.then(function() {
            expect(onExitWasCalled).to.equal(1);
          });
        }).finally(function() {
          expect(onExitWasCalled).to.equal(1);
          return lastDeferred.promise;
        }).finally(function () {
          expect(exitWasCalled).to.equal(1);
        });
      });

      it('process.exit with an error while natural exit completes', function() {
        var exitWasCalled = 0;
        var onExitWasCalled = 0;
        var exitCode;

        process.exit = function stubExit(code) {
          exitWasCalled++;
          exitCode = code;
        };

        var deferred;
        exit.captureExit();

        exit.onExit(function() {
          onExitWasCalled++;
          deferred = RSVP.defer();
          return deferred.promise;
        });

        process.exit();

        return delay(10).then(function() {
          expect(onExitWasCalled).to.equal(1);
          process.exit('the expected code');
          process.exit('NOT the expected code');

          return delay(10).then(function() {
            deferred.resolve();
          });
        }).then(function() {
          return delay(0).then(function() {
            expect(onExitWasCalled, 'exit handler invoked').to.equal(1);
            expect(exitWasCalled, 'real exit was called once').to.equal(1);
            expect(exitCode, 'called with an expected exit code').to.equal('the expected code');
          });
        });
      });

      it('process.exit with an error while natural exit with error code completes', function() {
        var exitWasCalled = 0;
        var onExitWasCalled = 0;
        var finalExitCode;

        process.exit = function stubExit(code) {
          exitWasCalled++;
          finalExitCode = code;
        };

        var deferred;
        exit.captureExit();

        exit.onExit(function() {
          onExitWasCalled++;
          deferred = RSVP.defer();
          return deferred.promise;
        });

        process.exit('the expected code');

        return delay(10).then(function() {
          expect(onExitWasCalled).to.equal(1);
          process.exit('an unexpected code');

          return delay(10).then(function() {
            deferred.resolve();
          });
        }).then(function() {
          return delay(0).then(function() {
            expect(onExitWasCalled, 'exit handler invoked').to.equal(1);
            expect(exitWasCalled, 'real exit was called once').to.equal(1);
            expect(finalExitCode, 'called with an expected exit code').to.equal('the expected code');
          });
        });
      });

    });
  });

  describe('.onExit', function() {
    var didExit;

    function handler(options) {
      options = options || {};
      var code = options.code;
      var timeout = options.timeout;

      return function() {
        // sync
        if (!timeout) {
          didExit++;
          if (code) {
            return RSVP.Promise.reject(code);
          }

          return;
        }

        // async if timeout specified
        return new RSVP.Promise(function(resolve, reject) {
          setTimeout(function() {
            didExit++;
            if (!code) {
              resolve();
            } else {
              reject(code);
            }
          }, timeout);
        });
      }
    };

    beforeEach(function() {
      didExit = 0;
    });

    it('subscribes', function() {
      exit.captureExit();
      function foo() {
        didExit++;
      }
      exit.onExit(foo);
      return exit._flush().then(function() {
        expect(didExit).to.equal(1);
        didExit = 0;
        return exit._flush().then(function() {
          expect(didExit).to.equal(0);
        });
      });
    });

    it('throws an exit code of the first registered handler which rejects', function() {
      exit.captureExit();

      exit.onExit(handler({
        timeout: 10
      }));

      exit.onExit(handler({
        code: 400,
        timeout: 20
      }));

      exit.onExit(handler({
        code: 503
      }));

      var resolved = false;
      return exit._flush()
        .then(function() {
          resolved = true;
        })
        .catch(function(reason) {
          expect(reason, 'fails with the first happened error code').to.equal(503);
          expect(didExit, '3 exit handlers are called').to.equal(3);
        })
        .finally(function() {
          expect(resolved, 'should not be resolved').to.equal(false);
        });
    });

    it('does not subscribe duplicates', function() {
      exit.captureExit();
      function foo() {
        didExit++;
      }
      exit.onExit(foo);
      exit.onExit(foo);
      return exit._flush().then(function() {
        expect(didExit).to.equal(1);
        didExit = 0;
        return exit._flush().then(function() {
          expect(didExit).to.equal(0);
        });
      });
    });

    it('throws if exit is not captured', function() {
      expect(function () {
        exit.onExit(function () { });
      }).to.throw('Cannot install handler when exit is not captured.  Call `captureExit()` first');
    });

    it('throws if an exit is already happening', function() {
      return new Promise(function (resolve, reject) {
        process.exit = function doNotReallyExit() { }
        exit.captureExit();
        function addHandler() {
          try {
            expect(function () {
              exit.onExit(function () { console.log("it's too late!"); });
            }).to.throw('Cannot install handler while `onExit` handlers are running.');
          } catch(e) {
            reject(e);
          }

          resolve();
        }
        exit.onExit(addHandler);

        process.exit(2);
      });
    });
  });

  describe('.offExit', function() {
    it('unsubscribes', function() {
      exit.captureExit();

      var didExit = 0;
      var didExitBar = 0;
      function foo() {
        didExit++;
      }
      function bar() {
        didExitBar++;
      }
      exit.onExit(foo);
      exit.onExit(bar);
      exit.offExit(foo);

      return exit._flush().then(function() {
        expect(didExit).to.equal(0);
        expect(didExitBar).to.equal(1);
      });
    });

    it('does not unsubscribe duplicates', function() {
      exit.captureExit();

      var didExit = 0;
      var didExitBar = 0;
      function foo() {
        didExit++;
      }
      function bar() {
        didExitBar++;
      }
      exit.onExit(foo);
      exit.onExit(bar);
      exit.offExit(foo);
      exit.offExit(foo);

      return exit._flush().then(function() {
        expect(didExit).to.equal(0);
        expect(didExitBar).to.equal(1);
      });
    });
  });

  describe('handlerCount', function() {
    it('returns the current handler length', function() {
      exit.captureExit();

      expect(exit.listenerCount()).to.equal(0);

      function foo() {}
      function bar() {}

      exit.onExit(foo);
      expect(exit.listenerCount()).to.equal(1);

      exit.onExit(bar);
      expect(exit.listenerCount()).to.equal(2);

      exit.offExit(foo);
      expect(exit.listenerCount()).to.equal(1);

      exit.offExit(bar);
      expect(exit.listenerCount()).to.equal(0);
    });
  });
});

describe('natural exit', function() {
  it('runs handlers on a natural exit', function() {
    var output = childProcess.execSync('node test-natural-exit-subprocess.js');
    expect(output+'').to.include('onExit');
    expect(output+'').to.include('exit');
  });

  it("exits with error code if a process.on('exit') handler calls process.exit with code", function() {
    var succeeded = false;
    try {
      var output = childProcess.execSync('node test-natural-exit-subprocess-error.js');
      succeeded = true;
    } catch(e) {
      expect(e.output+'').to.include('onExit');
      expect(e.output+'').to.include('exit');
    }

    if (succeeded) {
      throw new Error('Unexpected zero exit status for process.exit(1)');
    }
  });

  it("exits with error code if a captureExit.onExit handler calls process.exit with code", function() {
    var succeeded = false;
    try {
      var output = childProcess.execSync('node test-natural-exit-subprocess-error-exit-from-captures-on-exit.js');
      succeeded = true;
    } catch(e) {
      expect(e.output+'').to.include('onExit');
      expect(e.output+'').to.include('onExit2');
      expect(e.output+'').to.include('exit');
    }

    if (succeeded) {
      throw new Error('Unexpected zero exit status for process.exit(1)');
    }
  });

  it("status code from exit within procces.on('exit') handler trumps prior process.exit's", function() {
    return execa.shell('node process-exit-during-final-exit-subprocess.js').then(function(a) {
      expect(true, 'should not fulfill').to.eql(false);
    }, function(reason) {
      expect(reason.code).to.eql(1);
    });
  });
});

function delay(milliseconds) {
  return new RSVP.Promise(function(resolve) {
    setTimeout(resolve, milliseconds);
  });
}
