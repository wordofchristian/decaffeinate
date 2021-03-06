import FunctionPatcher from './FunctionPatcher';
import NodePatcher from './../../../patchers/SharedBlockPatcher';
import SharedBlockPatcher from '../../../patchers/SharedBlockPatcher';
import ReturnPatcher from './ReturnPatcher';
import type { SourceToken } from './../../../patchers/types';
import { SourceType } from 'coffee-lex';

export default class BlockPatcher extends SharedBlockPatcher {
  canPatchAsExpression(): boolean {
    return this.statements.every(
      statement => statement.canPatchAsExpression()
    );
  }

  prefersToPatchAsExpression(): boolean {
    return this.statements.length === 0 ||
      (this.statements.length === 1 &&  this.statements[0].prefersToPatchAsExpression());
  }

  setExpression(force=false): boolean {
    let willPatchAsExpression = super.setExpression(force);
    if (willPatchAsExpression && this.prefersToPatchAsExpression()) {
      this.statements.forEach(statement => statement.setExpression());
    }
  }

  setImplicitlyReturns() {
    // A block can have no statements if it only had a block comment.
    if (this.statements.length > 0) {
      this.statements[this.statements.length - 1].setImplicitlyReturns();
    }
  }

  /**
   * Force the patcher to treat the block as inline (semicolon-separated
   * statements) or not (newline-separated statements).
   */
  setShouldPatchInline(shouldPatchInline: boolean) {
    this.shouldPatchInline = shouldPatchInline;
  }

  patchAsStatement({ leftBrace=true, rightBrace=true }={}) {
    if (leftBrace) {
      this.insert(this.innerStart, '{');
    }

    let constructor = null;
    this.statements.forEach(
      (statement, i, statements) => {
        if (i === statements.length - 1 && this.parent instanceof FunctionPatcher) {
          if (statement instanceof ReturnPatcher && !statement.expression) {
            this.removeFinalEmptyReturn(statement);
            return;
          }
        }
        // If we see a constructor (which only happens when this is a class
        // block), defer it until the end. Its patching may need other class
        // keys to already be patched so that it can generate method binding
        // statements within the constructor.
        // Check against the 'Constructor' node type instead of doing
        // `instanceof` to avoid a circular import issue.
        if (statement.node.type === 'Constructor') {
          if (constructor) {
            throw this.error('Unexpectedly found two constructors in the same block.');
          }
          constructor = statement;
        } else {
          this.patchInnerStatement(statement);
        }
      }
    );
    if (constructor) {
      this.patchInnerStatement(constructor);
    }

    if (rightBrace) {
      if (this.inline()) {
        this.insert(this.innerEnd, ' }');
      } else {
        this.appendLineAfter('}', -1);
      }
    }
  }

  patchInnerStatement(statement) {
    let hasImplicitReturn = (
      statement.implicitlyReturns() &&
      !statement.explicitlyReturns()
    );

    if (statement.isSurroundedByParentheses() &&
        !statement.statementNeedsParens() &&
        !hasImplicitReturn) {
      this.remove(statement.outerStart, statement.innerStart);
      this.remove(statement.innerEnd, statement.outerEnd);
    }

    let implicitReturnPatcher = hasImplicitReturn ?
      this.implicitReturnPatcher() : null;
    if (implicitReturnPatcher) {
      implicitReturnPatcher.patchImplicitReturnStart(statement);
    }
    statement.patch();
    if (implicitReturnPatcher) {
      implicitReturnPatcher.patchImplicitReturnEnd(statement);
    }
    if (statement.statementNeedsSemicolon()) {
      this.insert(statement.outerEnd, ';');
    }
  }

  /**
   * Remove an unnecessary empty return at the end of a function. Ideally, we
   * want to remove the whole line, but that's only safe if the `return` is on a
   * line by itself. Otherwise, there might be bugs like code being pulled into
   * a comment on the previous line.
   */
  removeFinalEmptyReturn(statement) {
    let previousToken = this.sourceTokenAtIndex(statement.contentStartTokenIndex.previous());
    let nextToken = this.sourceTokenAtIndex(statement.contentEndTokenIndex.next());

    if (previousToken && previousToken.type === SourceType.NEWLINE &&
        (!nextToken || nextToken.type === SourceType.NEWLINE)) {
      this.remove(previousToken.start, statement.outerEnd);
    } else if (previousToken && previousToken.type === SourceType.SEMICOLON) {
      this.remove(previousToken.start, statement.outerEnd);
    } else {
      this.remove(statement.outerStart, statement.outerEnd);
    }
  }

  patchAsExpression({
    leftBrace=this.statements.length > 1,
    rightBrace=this.statements.length > 1
    }={}) {
    if (leftBrace) {
      this.insert(this.innerStart, '(');
    }
    if (this.statements.length === 0) {
      this.insert(this.contentStart, 'undefined');
    } else {
      this.statements.forEach(
        (statement, i, statements) => {
          statement.setRequiresExpression();
          statement.patch();
          if (i !== statements.length - 1) {
            let semicolonTokenIndex = this.getSemicolonSourceTokenBetween(
              statement,
              statements[i + 1]
            );
            if (semicolonTokenIndex) {
              let semicolonToken = this.sourceTokenAtIndex(semicolonTokenIndex);
              this.overwrite(semicolonToken.start, semicolonToken.end, ',');
            } else {
              this.insert(statement.outerEnd, ',');
            }
          }
        }
      );
    }
    if (rightBrace) {
      this.insert(this.innerEnd, ')');
    }
  }

  /**
   * @private
   */
  getSemicolonSourceTokenBetween(left: NodePatcher, right: NodePatcher): ?SourceToken {
    return this.indexOfSourceTokenBetweenPatchersMatching(
      left,
      right,
      token => token.type === SourceType.SEMICOLON
    );
  }

  /**
   * Blocks only exit via the last statement, so we check its code paths.
   */
  allCodePathsPresent(): boolean {
    return this.statements[this.statements.length - 1].allCodePathsPresent();
  }
}
