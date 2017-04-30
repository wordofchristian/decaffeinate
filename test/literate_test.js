import check from './support/check';

describe('literate mode', () => {
  it('handles a simple case', () => {
    check(`
      This is a *thing*.
      It doesn't do much.
      
          thing = 1
      
      This is another thing. It's a little more interesting.
      
          otherThing = for foo in stuff
            if foo % 2 == 0
              foo + 1
    `, `
      /*
       * This is a *thing*.
       * It doesn't do much.
       */
      let thing = 1;
      
      // This is another thing. It's a little more interesting.
      let otherThing = (() => {
        let result = [];
        for (let foo of Array.from(stuff)) {
          let item;
          if ((foo % 2) === 0) {
            item = foo + 1;
          }
          result.push(item);
        }
        return result;
      })();
    `, { literate: true });
  });

  it('handles a file starting with code and ending with a comment', () => {
    check(`
          a = 1
          b = 2
          c = 3
      Those are the first three letters of the alphabet.
    `, `
      let a = 1;
      let b = 2;
      let c = 3;
      // Those are the first three letters of the alphabet.
    `, { literate: true });
  });

  it('requires a blank line before moving to a code section', () => {
    check(`
      I can
        indent
          all that I want
            and it still will be in a comment.
      
          exceptNow = true
    `, `
      /*
       * I can
       *   indent
       *     all that I want
       *       and it still will be in a comment.
       */
      let exceptNow = true;
    `, { literate: true });
  });

  it('handles a file with `###` and `*/`', () => {
    check(`
      This won't be a multiline comment
      because it has a ###.
      
          a = 1
      
      This will be a multiline comment
      because /* is ok.
      
          b = 2
      
      But this line also can't be multiline
      because it has a */.
      
          c = 3
    `, `
      // This won't be a multiline comment
      // because it has a ###.
      let a = 1;
      
      /*
       * This will be a multiline comment
       * because /* is ok.
       */
      let b = 2;
      
      // But this line also can't be multiline
      // because it has a */.
      let c = 3;
    `, { literate: true });
  });

  it('treats normal coffee files as non-literate', () => {
    check(`
      a = 1
    `, `
      let a = 1;
    `, { filename: 'foo.coffee' });
  });

  it('treats .coffee.md files as literate', () => {
    check(`
      a = 1
    `, `
      // a = 1
    `, { filename: 'foo.coffee.md' });
  });

  it('treats .litcoffee files as literate', () => {
    check(`
      a = 1
    `, `
      // a = 1
    `, { filename: 'foo.litcoffee' });
  });
});
