import { describe, expect, it } from 'vitest';

import {
  canonicalCheckpointName,
  CHECKPOINT_NAME_MAX_LENGTH,
  CHECKPOINT_NAME_REQUIRED_MESSAGE,
  CHECKPOINT_NAME_TAKEN_MESSAGE,
  CHECKPOINT_NAME_TOO_LONG_MESSAGE,
  checkCheckpointName,
} from '@/lib/config/checkpoint';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';

/**
 * STORY-08.06 AC-2 and A-4 (SPEC section 8.3): the one rule for the name of a checkpoint, shared by the screen and the server. Trimmed, 1 to 100 characters, no spaces-only name, no control character. Pure.
 * Whether a name is free (any letter case) is the database's: the unique index on `lower(name)`.
 */

describe('AC-2: the name of a checkpoint', () => {
  it('says "Enter a name for this checkpoint." for an empty name and for one that is only spaces', () => {
    expect(CHECKPOINT_NAME_REQUIRED_MESSAGE).toBe('Enter a name for this checkpoint.');
    for (const typed of ['', ' ', '   ', '\t', '  ']) expect(checkCheckpointName(typed)).toEqual({ ok: false, message: CHECKPOINT_NAME_REQUIRED_MESSAGE });
  });

  it('trims the name and makes every run of white space one space', () => {
    expect(checkCheckpointName('  Before   AY \t insert  ')).toEqual({ ok: true, name: 'Before AY insert' });
    expect(canonicalCheckpointName('  A  B ')).toBe('A B');
  });

  it('folds compatibility forms, so full-width letters and the same letters are one name', () => {
    expect(checkCheckpointName('Ｂefore')).toEqual({ ok: true, name: 'Before' });
  });

  it('accepts exactly 100 characters and refuses 101, counted after trimming', () => {
    expect(CHECKPOINT_NAME_MAX_LENGTH).toBe(100);
    expect(checkCheckpointName('a'.repeat(100))).toEqual({ ok: true, name: 'a'.repeat(100) });
    expect(checkCheckpointName(`  ${'a'.repeat(100)}  `)).toEqual({ ok: true, name: 'a'.repeat(100) });
    expect(checkCheckpointName('a'.repeat(101))).toEqual({ ok: false, message: CHECKPOINT_NAME_TOO_LONG_MESSAGE });
    expect(CHECKPOINT_NAME_TOO_LONG_MESSAGE).toBe('Use 100 characters or fewer.');
  });

  it('counts a character outside the basic plane once, as the database does', () => {
    expect(checkCheckpointName('\u{1F600}'.repeat(100)).ok).toBe(true);
    expect(checkCheckpointName('\u{1F600}'.repeat(101)).ok).toBe(false);
  });

  it('refuses a control character, a zero-width character and a lone surrogate', () => {
    for (const typed of ['a\u0000b', 'a\u0007b', 'a​b', 'a‮b', 'a\ud800b']) expect(checkCheckpointName(typed), typed).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('has the masters\' sentence for a name that is taken', () => {
    expect(CHECKPOINT_NAME_TAKEN_MESSAGE).toBe('A checkpoint with this name already exists. Names must be unique.');
  });
});
