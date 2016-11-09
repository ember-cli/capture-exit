var expect = require('chai').expect;
var exit = require('./');

describe('capture-exit', function() {
  describe('.captureExit', function() {

  });

  describe('.onExit', function() {
    it('subscribes', function() {
      var didExit = 0;
      function foo() {
        didExit++;
      }
      exit.onExit(foo)
      return exit._flush().then(function() {
        expect(didExit).to.eql(1);
        didExit = 0;
        return exit._flush().then(function() {
          expect(didExit).to.eql(0);
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
        expect(didExit).to.eql(1);
        didExit = 0;
        return exit._flush().then(function() {
          expect(didExit).to.eql(0);
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
        expect(didExit).to.eql(0);
        expect(didExitBar).to.eql(1);
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
        expect(didExit).to.eql(0);
        expect(didExitBar).to.eql(1);
      });
    });
  });
});
