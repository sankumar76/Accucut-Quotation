import { describe, expect, it } from 'vitest';

import {
  evaluate,
  evaluateWithWorking,
  formatReference,
  parseTokens,
  referenceDisplayName,
  type Expression,
  type FormulaReference,
} from '@/lib/formula';
import { nodesOf } from '@/lib/formula/ast';
import type { Token } from '@/lib/formula/tokenizer';

import { CONTEXT, fieldAt, makeResolver, parseDisplay } from '../../support/formula-fixtures';

/**
 * Data that the types forbid fails loudly instead of falling through (coding standards section 10: every switch
 * on a union ends in `assertNever`). The values are forged from JSON, which is untyped, so no type assertion is
 * needed; they cannot come from the parser, only from a bug or a stored document edited by hand.
 */

function forged<T>(parts: Record<string, unknown>): T {
  return Object.assign(JSON.parse('{}'), parts);
}

const resolver = makeResolver({ fields: { A: '1' } });
const one = parseDisplay('1');
const unhandled = (what: string): RegExp => new RegExp(`^Unhandled ${what}\\.$`);

describe('unhandled node, operator and reference kinds (AC-1)', () => {
  it('an expression of an unknown kind is refused by the evaluator and the tree walk', () => {
    const node = forged<Expression>({ kind: 'bogus' });
    expect(() => evaluate(node, resolver)).toThrow(unhandled('expression'));
    expect(() => nodesOf(node)).toThrow(unhandled('value'));
  });

  it('an operator of an unknown kind is refused', () => {
    const node = forged<Expression>({ kind: 'binary', operator: '%', left: one, right: one });
    expect(() => evaluate(node, resolver)).toThrow(unhandled('operator'));
  });

  it('a comparison of an unknown kind is refused', () => {
    const node = forged<Expression>({ kind: 'if', condition: { operator: '!=', left: one, right: one }, whenTrue: one, whenFalse: one });
    expect(() => evaluate(node, resolver)).toThrow(unhandled('comparison'));
  });

  it('a reference of an unknown kind is refused by the evaluator, the writer and the display name', () => {
    const reference = forged<FormulaReference>({ kind: 'bogus' });
    expect(() => evaluate({ kind: 'reference', reference }, resolver)).toThrow(unhandled('reference'));
    expect(() => evaluateWithWorking({ kind: 'reference', reference }, resolver)).toThrow(unhandled('reference'));
    expect(() => formatReference(reference)).toThrow(unhandled('reference'));
    expect(() => referenceDisplayName(reference, CONTEXT)).toThrow(unhandled('reference'));
  });

  it('a token of an unknown kind is refused by the parser', () => {
    const token = forged<Token>({ kind: 'bogus', start: 0, end: 1 });
    expect(() => parseTokens([token], 1)).toThrow(unhandled('token'));
  });

  it('a function of an unknown name is refused by the parser', () => {
    const tokens = [
      forged<Token>({ kind: 'function', name: 'ROLLUP', start: 0, end: 6 }),
      forged<Token>({ kind: 'symbol', symbol: '(', start: 6, end: 7 }),
      forged<Token>({ kind: 'number', text: '1', start: 7, end: 8 }),
      forged<Token>({ kind: 'symbol', symbol: ')', start: 8, end: 9 }),
    ];
    expect(() => parseTokens(tokens, 9)).toThrow(unhandled('function'));
  });

  it('a function name that is not followed by a bracket is refused by the parser', () => {
    const tokens = [forged<Token>({ kind: 'function', name: 'SUM', start: 0, end: 3 }), forged<Token>({ kind: 'number', text: '1', start: 3, end: 4 })];
    expect(() => parseTokens(tokens, 4)).toThrow(/An operand is expected/);
  });

  it('does not name the value that was refused: it travels as the cause and not in the message', () => {
    try {
      evaluate(forged<Expression>({ kind: 'Zebra42' }), resolver);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).not.toContain('Zebra42');
        expect(error.cause).toMatchObject({ kind: 'Zebra42' });
      }
    }
    expect(referenceDisplayName({ kind: 'field', id: fieldAt('A') }, CONTEXT)).toBe('A');
  });
});
