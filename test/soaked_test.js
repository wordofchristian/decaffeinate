import check from './support/check';
import validate from './support/validate';

describe('soaked expressions', () => {
  describe('function application', () => {
    it('works with a basic function', () => {
      check(`
        a?()
      `, `
        if (typeof a === 'function') {
          a();
        }
      `);
    });

    it('works with a function that is not safe to repeat', () => {
      check(`
        a()?()
      `, `
        __guardFunc__(a(), f => f());
        function __guardFunc__(func, transform) {
          return typeof func === 'function' ? transform(func) : undefined;
        }
      `);
    });

    it('works in an expression context', () => {
      check(`
        a(b()?())
      `, `
        a(__guardFunc__(b(), f => f()));
        function __guardFunc__(func, transform) {
          return typeof func === 'function' ? transform(func) : undefined;
        }
      `);
    });

    it('preserves arguments', () => {
        check(`
        a()?(1, 2, 3)
      `, `
        __guardFunc__(a(), f => f(1, 2, 3));
        function __guardFunc__(func, transform) {
          return typeof func === 'function' ? transform(func) : undefined;
        }
      `);
    });

    it('handles nested soaked function calls', () => {
      check(`
        a?(1)?(2)
      `, `
        __guardFunc__(typeof a === 'function' ? a(1) : undefined, f => f(2));
        function __guardFunc__(func, transform) {
          return typeof func === 'function' ? transform(func) : undefined;
        }
      `);
    });

    it('works with repeatable member access as the function', () => {
      check(`
        a.b?()
      `, `
        if (typeof a.b === 'function') {
          a.b();
        }
      `);
    });

    it('works with non-repeatable member access as the function', () => {
      check(`
        a().b?()
      `, `
        __guardMethod__(a(), 'b', o => o.b());
        function __guardMethod__(obj, methodName, transform) {
          if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
            return transform(obj, methodName);
          } else {
            return undefined;
          }
        }
      `);
    });

    it('works with repeatable dynamic member access as the function', () => {
      check(`
        a[b]?()
      `, `
        if (typeof a[b] === 'function') {
          a[b]();
        }
      `);
    });

    it('works with non-repeatable dynamic member access as the function', () => {
      check(`
        a()[b]?()
      `, `
        __guardMethod__(a(), b, (o, m) => o[m]());
        function __guardMethod__(obj, methodName, transform) {
          if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
            return transform(obj, methodName);
          } else {
            return undefined;
          }
        }
      `);
    });

    it('works with dynamic member access whose key is unsafe to repeat as the function', () => {
      check(`
        a[b()]?()
      `, `
        __guardMethod__(a, b(), (o, m) => o[m]());
        function __guardMethod__(obj, methodName, transform) {
          if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
            return transform(obj, methodName);
          } else {
            return undefined;
          }
        }
      `);
    });

    it('allows undeclared variables for soaked function calls in an expression context', () => {
      check(`
      a = b?()
    `, `
      let a = typeof b === 'function' ? b() : undefined;
    `);
    });

    it('evaluates soaked function calls', () => {
      validate(`
        f = -> 3
        o = f?()
      `, 3);
    });

    it('skips soaked function invocations on non-functions', () => {
      validate(`
        f = 3
        o = f?()
      `, undefined);
    });

    it('properly sets this in soaked method calls', () => {
      validate(`
        o = false
        a = {
          b: ->
            if a == this
              o = true
        }
        a.b?()
      `, true);
    });

    it('properly sets `this` in shorthand-`this` soaked method calls', () => {
      validate(`
        o = false
        a = {
          b: ->
            @c?()
          c: ->
            if a == this
              o = true
        }
        a.b()
      `, true);
    });

    it('properly sets `this` in soaked dynamic method calls', () => {
      validate(`
        o = false
        a = {
          b: ->
            if a == this
              o = true
        }
        a['b']?()
      `, true);
    });
  });

  describe('soaked member access', () => {
    it('handles soaked member access assignment', () => {
      check(`
        canvasContext?.font = $('body').css('font')
      `, `
        if (typeof canvasContext !== 'undefined' && canvasContext !== null) {
          canvasContext.font = $('body').css('font');
        }
      `);
    });

    it('handles soaked member access with conflicting variable names', () => {
      check(`
        x = 5
        a()?.b(x)
      `, `
        let x = 5;
        __guard__(a(), x1 => x1.b(x));
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('handles soaked member access with assignment within an expression', () => {
      check(`
        a(b?.c = d)
      `, `
        a(typeof b !== 'undefined' && b !== null ? b.c = d : undefined);
      `);
    });

    it('handles soaked member access with a function call', () => {
      check(`
        a?.b()
      `, `
        if (typeof a !== 'undefined' && a !== null) {
          a.b();
        }
      `);
    });

    it('handles soaked member access on the result of a function call', () => {
      check(`
        a.b()?.c
      `, `
        __guard__(a.b(), x => x.c);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('allows soaked member access to be used in an expression', () => {
      check(`
        a(b?.c)
      `, `
        a(typeof b !== 'undefined' && b !== null ? b.c : undefined);
      `);
    });

    it('handles dynamic member access', () => {
      check(`
        a?[b]()
      `, `
        if (typeof a !== 'undefined' && a !== null) {
          a[b]();
        }
      `);
    });

    it('handles soaked dynamic member access followed by normal dynamic member access', () => {
      check(`
        a?[b].c[d]
      `, `
        if (typeof a !== 'undefined' && a !== null) {
          a[b].c[d];
        }
      `);
    });

    it('handles nested soaked dynamic member access', () => {
      check(`
        a?[b].c?[d]
      `, `
        __guard__(typeof a !== 'undefined' && a !== null ? a[b].c : undefined, x => x[d]);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('allows undeclared variables for soaked dynamic member accesses in an expression context', () => {
      check(`
        a = b?[c]
      `, `
        let a = typeof b !== 'undefined' && b !== null ? b[c] : undefined;
      `);
    });

    it('uses a shorter check for declared variables for soaked dynamic member accesses in an expression context', () => {
      check(`
        b = {}
        a = b?[c]
      `, `
        let b = {};
        let a = b != null ? b[c] : undefined;
      `);
    });

    it('handles soaked member access within a condition', () => {
      check(`
        if a?.b then c
      `, `
        if (typeof a !== 'undefined' && a !== null ? a.b : undefined) { c; }
      `);
    });

    it('handles nested soaked member access', () => {
      check(`
        a()?.b()?.c = 0;
      `, `
        __guard__(__guard__(a(), x1 => x1.b()), x => x.c = 0);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('handles explicit parens around soaks', () => {
      check(`
        (a?.b).c
      `, `
        (typeof a !== 'undefined' && a !== null ? a.b : undefined).c;
      `);
    });

    it('keeps postfix ++ within soak expressions', () => {
      check(`
        a()?.b++
      `, `
        __guard__(a(), x => x.b++);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps postfix -- within soak expressions', () => {
      check(`
        a()?.b--
      `, `
        __guard__(a(), x => x.b--);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps prefix ++ within soak expressions', () => {
      check(`
        ++a()?.b
      `, `
        __guard__(a(), x => ++x.b);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps prefix ++ within soaked dynamic accesses', () => {
      check(`
        ++a()?[b]
      `, `
        __guard__(a(), x => ++x[b]);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps prefix ++ within soaked dynamic accesses where the LHS is surrounded by parens', () => {
      check(`
        ++(a())?[b]
      `, `
        __guard__((a()), x => ++x[b]);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps prefix ++ within soaked function calls', () => {
      check(`
        ++a()?(b).c
      `, `
        __guardFunc__(a(), f => ++f(b).c);
        function __guardFunc__(func, transform) {
          return typeof func === 'function' ? transform(func) : undefined;
        }
      `);
    });

    it('keeps prefix ++ within soaked method calls', () => {
      check(`
        ++a().b?(c).d
      `, `
        __guardMethod__(a(), 'b', o => ++o.b(c).d);
        function __guardMethod__(obj, methodName, transform) {
          if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
            return transform(obj, methodName);
          } else {
            return undefined;
          }
        }
      `);
    });

    it('keeps prefix ++ within soaked dynamic method calls', () => {
      check(`
        ++a()[b]?(c).d
      `, `
        __guardMethod__(a(), b, (o, m) => ++o[m](c).d);
        function __guardMethod__(obj, methodName, transform) {
          if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
            return transform(obj, methodName);
          } else {
            return undefined;
          }
        }
      `);
    });

    it('keeps prefix -- within soak expressions', () => {
      check(`
        --a()?.b
      `, `
        __guard__(a(), x => --x.b);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('keeps delete within soak expressions', () => {
      check(`
        delete a()?.b
      `, `
        __guard__(a(), x => delete x.b);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('handles soaked prototype access', () => {
      check(`
        a()?::b
      `, `
        __guard__(a(), x => x.prototype.b);
        function __guard__(value, transform) {
          return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
        }
      `);
    });

    it('correctly handles normal soaked access', () => {
      validate(`
        a = {b: 5}
        o = a?.b
      `, 5);
    });

    it('correctly handles missing soaked access', () => {
      validate(`
        a = {b: null}
        o = a.b?.c
      `, undefined);
    });

    it('correctly handles dynamic soaked access', () => {
      validate(`
        a = {b: 5}
        o = a?['b']
      `, 5);
    });

    it('correctly handles missing dynamic soaked access', () => {
      validate(`
        a = {b: null}
        o = a.b?['c']
      `, undefined);
    });

    it('stops evaluating the expression when hitting a soak failure', () => {
        validate(`
        a = {b: 5}
        o = a.d?.e.f()
      `, undefined);
    });

    it('skips assignment when a soak fails', () => {
      validate(`
        x = 1
        y = null
        z = {}
        y?.a = x++
        z?.a = x++
        o = x
      `, 2);
    });
  });

  it('handles a soaked method call on a soaked member access', () => {
    check(`
      a?.b?()
    `, `
      __guardMethod__(a, 'b', o => o.b());
      function __guardMethod__(obj, methodName, transform) {
        if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
          return transform(obj, methodName);
        } else {
          return undefined;
        }
      }
    `);
  });

  it('handles a soaked method call on a soaked dynamic member access', () => {
    check(`
      a?[b]?()
    `, `
      __guardMethod__(a, b, (o, m) => o[m]());
      function __guardMethod__(obj, methodName, transform) {
        if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
          return transform(obj, methodName);
        } else {
          return undefined;
        }
      }
    `);
  });
  
  it('handles a combination of soaked function calls and soaked member accesses', () => {
    check(`
      a?(1)?.b?()?[c].d?()?.e = 1
    `, `
      __guard__(__guardMethod__(__guard__(__guardMethod__(typeof a === 'function' ? a(1) : undefined, 'b', o1 => o1.b()), x1 => x1[c]), 'd', o => o.d()), x => x.e = 1);
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
      function __guardMethod__(obj, methodName, transform) {
        if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
          return transform(obj, methodName);
        } else {
          return undefined;
        }
      }
    `);
  });

  it('properly sets patching bounds for soaked function applications', () => {
    check(`
      f()?(a, 
        b: c
        d: e)
    `, `
      __guardFunc__(f(), f => f(a, { 
        b: c,
        d: e
      }));
      function __guardFunc__(func, transform) {
        return typeof func === 'function' ? transform(func) : undefined;
      }
    `);
  });

  it('properly transforms an `in` operator with a soak expression on the left', () => {
    check(`
      a?.b in c
    `, `
      Array.from(c).includes(typeof a !== 'undefined' && a !== null ? a.b : undefined);
    `);
  });

  it('properly transforms an `in` operator with a soak expression on the right', () => {
    check(`
      a in b?.c
    `, `
      Array.from(typeof b !== 'undefined' && b !== null ? b.c : undefined).includes(a);
    `);
  });

  it('handles a soaked access used with an existence operator', () => {
    check(`
      a = b()?.c ? d
    `, `
      let left;
      let a = (left = __guard__(b(), x => x.c)) != null ? left : d;
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked dynamic access used with an existence operator', () => {
    check(`
      a = b()?[c()] ? d
    `, `
      let left;
      let a = (left = __guard__(b(), x => x[c()])) != null ? left : d;
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked access used with an existence assignment operator', () => {
    check(`
      a()?.b ?= c
    `, `
      let base;
      __guard__((base = a()), x => x.b != null ? base.b : (base.b = c));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked dynamic access used with an existence assignment operator', () => {
    check(`
      a()?[b()] ?= d
    `, `
      let base;
      let name;
      __guard__((base = a()), x => x[name = b()] != null ? base[name] : (base[name] = d));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked access used with a logical assignment operator', () => {
    check(`
      a()?.b and= c
    `, `
      let base;
      __guard__((base = a()), x => x.b && (base.b = c));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked dynamic access used with a logical assignment operator', () => {
    check(`
      a()?[b()] and= d
    `, `
      let base;
      let name;
      __guard__((base = a()), x => x[name = b()] && (base[name] = d));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('allows a repeated soak operation as a loop target', () => {
    check(`
      i + j for j, i in foo()?.bar ? [] 
    `, `
      let left;
      let iterable = (left = __guard__(foo(), x => x.bar)) != null ? left : [];
      for (let i = 0; i < iterable.length; i++) { let j = iterable[i]; i + j; } 
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a soaked dynamic access used with a logical assignment operator with a function RHS', () => {
    check(`
      a.b()?.c or= (it) -> it
    `, `
      let base;
      __guard__((base = a.b()), x => x.c || (base.c = it => it));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a possibly undeclared variable in a statement context', () => {
    check(`
      ++a?.b[c()]
    `, `
      if (typeof a !== 'undefined' && a !== null) {
        ++a.b[c()];
      }
    `);
  });

  it('handles a simple identifier that has been declared in a statement context', () => {
    check(`
      a = f()
      ++a?.b[c()]
    `, `
      let a = f();
      if (a != null) {
        ++a.b[c()];
      }
    `);
  });

  it('handles a possibly undeclared variable in an expression context', () => {
    check(`
      x = ++a?.b[c()]
    `, `
      let x = typeof a !== 'undefined' && a !== null ? ++a.b[c()] : undefined;
    `);
  });

  it('handles a simple identifier that has been declared in an expression context', () => {
    check(`
      a = f()
      x = ++a?.b[c()]
    `, `
      let a = f();
      let x = a != null ? ++a.b[c()] : undefined;
    `);
  });

  it('properly follows precedence with soak expressions', () => {
    check(`
      a = f()
      x = a?.b or []
    `, `
      let a = f();
      let x = (a != null ? a.b : undefined) || [];
    `);
  });

  it('properly handles chained simple soak operations', () => {
    check(`
      a = f()
      if a?.b?.c?
        d
    `, `
      let a = f();
      if (__guard__(a != null ? a.b : undefined, x => x.c) != null) {
        d;
      }
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('properly handles a soaked method call followed by a binary exists op', () => {
    check(`
      a = b?.filter(-> c) ? null
    `, `
      let left;
      let a = (left = (typeof b !== 'undefined' && b !== null ? b.filter(() => c) : undefined)) != null ? left : null;
    `);
  });

  it('properly handles a soak operation inside a ternary', () => {
    check(`
      b = 0
      a = if b?.c then d else e
    `, `
      let b = 0;
      let a = (b != null ? b.c : undefined) ? d : e;
    `);
  });

  it('has the correct runtime behavior with a soak operation inside a ternary', () => {
    validate(`
      a = {b: 'should not return'}
      o = if a?.b then 'should return'
    `, 'should return');
  });

  it('does not add parens around a soaked while condition', () => {
    check(`
      a = {}
      while a?.b
        break
    `, `
      let a = {};
      while (a != null ? a.b : undefined) {
        break;
      }
    `);
  });

  it('does not add parens around a soaked indexing expression', () => {
    check(`
      a = {}
      b = {}
      d = a[b?.c]
    `, `
      let a = {};
      let b = {};
      let d = a[b != null ? b.c : undefined];
    `);
  });

  it('properly handles a soaked condition in an `unless` statement', () => {
    check(`
      unless a?.b
        c
    `, `
      if (!(typeof a !== 'undefined' && a !== null ? a.b : undefined)) {
        c;
      }
    `);
  });

  it('properly handles a soaked condition in an `until` statement', () => {
    check(`
      until a?.b
        c
    `, `
      while (!(typeof a !== 'undefined' && a !== null ? a.b : undefined)) {
        c;
      }
    `);
  });

  it('properly handles a soaked condition in an `unless` statement with an assignment', () => {
    check(`
      unless a = b?.c
        d
    `, `
      let a;
      if (!(a = typeof b !== 'undefined' && b !== null ? b.c : undefined)) {
        d;
      }
    `);
  });

  it('properly patches the object key in a soaked dynamic member access', () => {
    check(`
      a?[@b]
    `, `
      if (typeof a !== 'undefined' && a !== null) {
        a[this.b];
      }
    `);
  });

  it('properly places parens for expression-style soaked assignment', () => {
    check(`
      a = b?.c = 1
    `, `
      let a = (typeof b !== 'undefined' && b !== null ? b.c = 1 : undefined);
    `);
  });

  it('handles simple soaked new operations', () => {
    check(`
      new A?(b)
    `, `
      if (typeof A === 'function') {
        new A(b);
      }
    `);
  });

  it('handles implicit soaked new operations', () => {
    check(`
      new A? b
    `, `
      if (typeof A === 'function') {
        new A(b);
      }
    `);
  });

  it('handles complex soaked new operations', () => {
    check(`
      new A[b()]?(c)
    `, `
      __guardFunc__(A[b()], f => new f(c));
      function __guardFunc__(func, transform) {
        return typeof func === 'function' ? transform(func) : undefined;
      }
    `);
  });

  it('handles soaked slice operations', () => {
    check(`
      a = b?[c..d]
    `, `
      let a = __guard__(b, x => x.slice(c, +d + 1 || undefined));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('properly computes the soak container for soaked slice operations', () => {
    check(`
      a = b?[c..d].e
    `, `
      let a = __guard__(b, x => x.slice(c, +d + 1 || undefined).e);
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles soaked splice operations', () => {
    check(`
      a?[b..c] = d
    `, `
      __guard__(a, x => x.splice(b, c - b + 1, ...[].concat(d)));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles complex splice operations', () => {
    check(`
      [a, b()?[c..]] = d
    `, `
      let a;
      a = d[0], __guard__(b(), x => x.splice(c, 9e9, ...[].concat(d[1])));
      function __guard__(value, transform) {
        return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
      }
    `);
  });

  it('handles a parenthesized soak operation within `unless`', () => {
    check(`
      a = {b: 1}
      unless (a?.b)
        c
    `, `
      let a = {b: 1};
      if (!(a != null ? a.b : undefined)) {
        c;
      }
    `);
  });

  it('handles a nested parenthesized soak operation within `unless`', () => {
    check(`
      a = {b: 1}
      unless (a?.b.c)
        d
    `, `
      let a = {b: 1};
      if (!(a != null ? a.b.c : undefined)) {
        d;
      }
    `);
  });

  it('handles a parenthesized soak operation within `until`', () => {
    check(`
      a = {b: 1}
      until (a?.b)
        c
    `, `
      let a = {b: 1};
      while (!(a != null ? a.b : undefined)) {
        c;
      }
    `);
  });

  it('handles a parenthesized soak operation within a negated logical operator', () => {
    check(`
      a = {b: 1}
      unless c and (a?.b)
        d
    `, `
      let a = {b: 1};
      if (!c || (!(a != null ? a.b : undefined))) {
        d;
      }
    `);
  });

  it('handles a parenthesized soak operation within a negated switch case', () => {
    check(`
      a = {b: 1}
      switch
        when (a?.b)
          c
    `, `
      let a = {b: 1};
      switch (false) {
        case (!(a != null ? a.b : undefined)):
          c;
          break;
      }
    `);
  });
});
