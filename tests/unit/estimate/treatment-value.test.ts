import { describe, expect, it } from 'vitest';

import {
  CHOOSE_TREATMENT_MESSAGE,
  decodeTreatment,
  encodeTreatment,
  FLAG_MESSAGE,
  isFlagOn,
  isOtherTreatment,
  OTHER_TREATMENT_REQUIRED_MESSAGE,
  readFlagInput,
  readTreatmentInput,
  treatmentChoiceOf,
  treatmentWordsOf,
} from '@/lib/estimate/treatment-value';
import { textTooLongMessage } from '@/lib/estimate/validation';
import { NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID, OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';

/**
 * STORY-05.06 AC-1, AC-3, AC-4: the value of Treatment / Color and of a surface treatment, read by the browser and by the server with one rule. A treatment is an ID and words; "Other" needs
 * words (trimmed, up to 100 characters); a flag is 1 or 0. Every ID and word is invented.
 */

const LISTED = '00000000-0000-4000-8000-000700000c01';

describe('the choice as one text', () => {
  it('is the JSON of the ID and the words, in that order, and reads back to the same choice', () => {
    const text = encodeTreatment({ id: LISTED, text: 'Invented powder finish' });
    expect(text).toBe(`{"id":"${LISTED}","text":"Invented powder finish"}`);
    expect(decodeTreatment(text)).toEqual({ id: LISTED, text: 'Invented powder finish' });
  });

  it.each([[''], ['   '], ['not json'], ['5'], ['null'], ['[]'], ['{"id":"x"}'], ['{"id":"","text":"x"}'], ['{"id":5,"text":"x"}'], ['{"id":"x","text":5}'], ['{"id":"x","text":"y","more":1}']])('is no choice for %j', (text) => {
    expect(decodeTreatment(text)).toBeNull();
  });

  it('lower-cases the ID and keeps the words as they are', () => {
    expect(treatmentChoiceOf({ id: ` ${LISTED.toUpperCase()} `, text: ' Words ' })).toEqual({ id: LISTED, text: ' Words ' });
  });

  it('knows "Other" by its fixed ID in any letter case', () => {
    expect(isOtherTreatment(OTHER_TREATMENT_ID)).toBe(true);
    expect(isOtherTreatment(OTHER_TREATMENT_ID.toUpperCase())).toBe(true);
    expect(isOtherTreatment(LISTED)).toBe(false);
    expect(isOtherTreatment(NOT_APPLICABLE_TREATMENT_ID)).toBe(false);
  });
});

describe('AC-3, AC-4: one typed Treatment / Color', () => {
  it('a blank clears it', () => {
    expect(readTreatmentInput('')).toEqual({ ok: true, value: null });
    expect(readTreatmentInput('   ')).toEqual({ ok: true, value: null });
  });

  it('a listed entry and "Not applicable" are their ID, and the words sent are kept trimmed (the server writes the row\'s name)', () => {
    expect(readTreatmentInput(encodeTreatment({ id: LISTED, text: '  Invented powder finish ' }))).toEqual({ ok: true, value: encodeTreatment({ id: LISTED, text: 'Invented powder finish' }) });
    expect(readTreatmentInput(encodeTreatment({ id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME }))).toEqual({
      ok: true,
      value: encodeTreatment({ id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME }),
    });
  });

  it('"Other" keeps its typed words, trimmed', () => {
    expect(readTreatmentInput(encodeTreatment({ id: OTHER_TREATMENT_ID, text: '  Invented matt black  ' }))).toEqual({ ok: true, value: encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'Invented matt black' }) });
  });

  it('"Other" with no words, or only spaces, is refused with the words for an empty box', () => {
    for (const text of ['', '   ']) expect(readTreatmentInput(encodeTreatment({ id: OTHER_TREATMENT_ID, text }))).toEqual({ ok: false, message: OTHER_TREATMENT_REQUIRED_MESSAGE });
  });

  it('"Other" takes 100 characters and refuses 101, counted after trimming', () => {
    expect(readTreatmentInput(encodeTreatment({ id: OTHER_TREATMENT_ID, text: ` ${'x'.repeat(100)} ` })).ok).toBe(true);
    expect(readTreatmentInput(encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'x'.repeat(101) }))).toEqual({ ok: false, message: textTooLongMessage(100) });
  });

  it('"Other" with a control character in its words is refused', () => {
    expect(readTreatmentInput(encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'bad\u0000word' })).ok).toBe(false);
  });

  it.each([['Invented powder finish'], ['{"id":"x"}'], ['[]']])('text that is not a choice (%j) is refused with the words to choose from the list', (typed) => {
    expect(readTreatmentInput(typed)).toEqual({ ok: false, message: CHOOSE_TREATMENT_MESSAGE });
  });
});

describe('what a stored Treatment / Color says', () => {
  it('is its words, trimmed, for a stored choice', () => {
    expect(treatmentWordsOf({ id: LISTED, text: ' Invented powder finish ' })).toBe('Invented powder finish');
  });

  it.each([[undefined], [null], [''], ['Invented powder finish'], [encodeTreatment({ id: LISTED, text: 'x' })], [{ id: LISTED }], [{ id: LISTED, text: '   ' }], [5]])('is empty for %j', (stored) => {
    expect(treatmentWordsOf(stored)).toBe('');
  });
});

describe('AC-1: one typed flag', () => {
  it('a blank clears it, 1 is chosen and 0 is not', () => {
    expect(readFlagInput('')).toEqual({ ok: true, value: null });
    expect(readFlagInput(' 1 ')).toEqual({ ok: true, value: '1' });
    expect(readFlagInput('0')).toEqual({ ok: true, value: '0' });
  });

  it.each([['2'], ['yes'], ['1.00'], ['-1'], ['true']])('%j is refused', (typed) => {
    expect(readFlagInput(typed)).toEqual({ ok: false, message: FLAG_MESSAGE });
  });

  it('is on for 1 and for nothing else', () => {
    expect(isFlagOn('1')).toBe(true);
    expect(isFlagOn(' 1 ')).toBe(true);
    for (const text of ['0', '', '2', 'yes']) expect(isFlagOn(text), text).toBe(false);
  });
});
