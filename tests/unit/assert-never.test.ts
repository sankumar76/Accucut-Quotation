import { describe, expect, it } from 'vitest';

import { assertNever } from '@/lib/assert-never';

import { thrownAs } from '../support/thrown';

/** STD-06: the message names what was unhandled, never its content (it may be Restricted). The value is the cause. */

// Reaching `assertNever` with a real value is a bug the types normally rule out; the tests force it.
function unreachable(...args: unknown[]): unknown {
  return Reflect.apply(assertNever, undefined, args);
}

describe('assertNever', () => {
  it('throws, and the message does not contain the value', () => {
    const error = thrownAs(() => unreachable({ operand: 'a-rate-name', amount: '12345.67' }), Error);
    expect(error.message).toBe('Unhandled value.');
    expect(error.message).not.toContain('12345.67');
    expect(error.message).not.toContain('a-rate-name');
  });

  it('names what kind of thing was unhandled', () => {
    expect(thrownAs(() => unreachable('anything', 'field kind'), Error).message).toBe('Unhandled field kind.');
  });

  it('keeps the value as the cause, for the logger\'s redaction, not as text', () => {
    const value = { kind: 'surprise' };
    expect(thrownAs(() => unreachable(value), Error).cause).toBe(value);
  });

  it('does not fail on a value JSON cannot print (a bigint or a cycle) and hide the real defect', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(thrownAs(() => unreachable(cyclic), Error).message).toBe('Unhandled value.');
    expect(thrownAs(() => unreachable(10n), Error).message).toBe('Unhandled value.');
  });
});
