var expect = require('chai').expect;
var RSVP = require('rsvp');

var originalExit = process.exit; // keep this around for good measure.
var exit = require('./');

describe('capture-exit', function() {
  beforeEach(function() {
    expect(process.exit, 'ensure we start in a correct state').to.equal(originalExit);
  });

  afterEach(function() {
    // always restore, in case we have bugs in our code while developing
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
  });

  describe('.captureExit', function() {
    afterEach(function() {
      // always restore, in case we have bugs in our code while developing
      process.exit = originalExit;
      exit.releaseExit();
    });

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
      it('works', function() {
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

        return new RSVP.Promise(function(resolve, reject) {
          setTimeout(function() {
            try {
            deferred.resolve();

            resolve(deferred.promise.then(function() {
              expect(onExitWasCalled).to.equal(1);
            }));
            } catch(e) {
              reject(e);
            }
          }, 100);
        }).finally(function() {
          expect(onExitWasCalled).to.equal(1);
        });
      });
    });
  });

  describe('.onExit', function() {
    it('subscribes', function() {
      var didExit = 0;
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
    it('does not subscribe duplicates', function() {
      var didExit = 0;
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
  });

  describe('.offExit', function() {
    it('unsubscribes', function() {
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
});
