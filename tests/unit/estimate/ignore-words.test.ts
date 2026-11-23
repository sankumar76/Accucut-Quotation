import { describe, expect, it } from 'vitest';

import { checkIgnoreRemarks, IGNORE_REMARKS_MAX_LENGTH, IGNORE_REMARKS_REQUIRED_MESSAGE, IGNORE_REMARKS_TOO_LONG_MESSAGE } from '@/lib/estimate/ignore-words';
import { validateTextInput } from '@/lib/estimate/validation';

/**
 * AQP-401 AC-2 (FR-109; NFR-032; DL-219): the Ignore remarks are judged by the shared text rule through `checkIgnoreRemarks`, the one function the dialog and the service both call. The hidden-character
 * cases compare with what the shared rule says, never a copied sentence, so the text changes in one place when GitHub #429 names the character. Every text is invented.
 */

const RULE = { multiline: true, maxLength: IGNORE_REMARKS_MAX_LENGTH, countCodePoints: true } as const;
const sharedMessage = (text: string): string => {
  const checked = validateTextInput(text, RULE);
  if (checked.ok) throw new Error('The shared rule accepted a text that must be refused.');
  return checked.message;
};

describe('AC-2: the remarks limit is one named constant', () => {
  it('is 500, and the words that mention it read it', () => {
    expect(IGNORE_REMARKS_MAX_LENGTH).toBe(500);
    expect(IGNORE_REMARKS_TOO_LONG_MESSAGE).toBe(`Use ${String(IGNORE_REMARKS_MAX_LENGTH)} characters or fewer.`);
    expect(IGNORE_REMARKS_REQUIRED_MESSAGE).toBe('Enter remarks. They are kept in the audit log.');
  });
});

describe('AC-2: empty, length, hidden character, in that order', () => {
  it.each(['', '   ', '\n\t  ', '\r\n'])('refuses %j as empty', (text) => {
    expect(checkIgnoreRemarks(text)).toEqual({ ok: false, message: IGNORE_REMARKS_REQUIRED_MESSAGE });
  });

  it('accepts exactly the limit and refuses one more (the boundary reads the constant)', () => {
    expect(checkIgnoreRemarks('x'.repeat(IGNORE_REMARKS_MAX_LENGTH))).toEqual({ ok: true, remarks: 'x'.repeat(IGNORE_REMARKS_MAX_LENGTH) });
    expect(checkIgnoreRemarks('x'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1))).toEqual({ ok: false, message: IGNORE_REMARKS_TOO_LONG_MESSAGE });
  });

  it('counts code points, so 500 emoji pass and 501 do not', () => {
    expect(checkIgnoreRemarks('\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH)).ok).toBe(true);
    expect(checkIgnoreRemarks('\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1))).toEqual({ ok: false, message: IGNORE_REMARKS_TOO_LONG_MESSAGE });
  });

  it('counts a line feed as one character, and folds CRLF into one line feed', () => {
    const lines = `${'a'.repeat(249)}\r\n${'b'.repeat(250)}`;
    expect(checkIgnoreRemarks(lines)).toEqual({ ok: true, remarks: `${'a'.repeat(249)}\n${'b'.repeat(250)}` });
    expect(checkIgnoreRemarks(`${lines}c`)).toEqual({ ok: false, message: IGNORE_REMARKS_TOO_LONG_MESSAGE });
  });

  it('keeps several lines, and the trimmed text', () => {
    expect(checkIgnoreRemarks('  The customer chose another supplier.\nNo quote is needed.  \n')).toEqual({ ok: true, remarks: 'The customer chose another supplier.\nNo quote is needed.' });
  });

  it('says "too long" before it says "hidden character" when a text is both', () => {
    expect(checkIgnoreRemarks(`${'x'.repeat(IGNORE_REMARKS_MAX_LENGTH)}‍`)).toEqual({ ok: false, message: IGNORE_REMARKS_TOO_LONG_MESSAGE });
  });
});

describe('AC-2: hidden characters are the shared rule\'s refusal (DL-219)', () => {
  it.each([
    ['a zero-width joiner', 'Not‍ taken forward'],
    ['a zero-width non-joiner', 'Not‌ taken forward'],
    ['a bidirectional override', 'Not‮ taken forward'],
    ['a NUL', 'Not\u0000 taken forward'],
    ['a lone surrogate', 'Not\uD800 taken forward'],
  ])('refuses %s with the shared rule\'s own output', (_name, text) => {
    expect(checkIgnoreRemarks(text)).toEqual({ ok: false, message: sharedMessage(text) });
  });

  it('accepts a line feed', () => {
    expect(checkIgnoreRemarks('One.\nTwo.').ok).toBe(true);
  });
});
