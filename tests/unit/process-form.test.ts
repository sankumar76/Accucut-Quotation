import { describe, expect, it } from 'vitest';

import { editChanges, formProblems, initialValues, newRateBody, withoutError, type FormValues } from '@/lib/masters/process-form';
import { changesFrom, DEFAULT_VALUE_MESSAGE, NAME_REQUIRED_MESSAGE, UNIT_REQUIRED_MESSAGE, unitLabel, valueSymbol } from '@/lib/masters/process-items';

/**
 * STORY-02.01 (AC-2, AC-3; QLT-12 and STD-05 of the G6): what the add and edit form checks and sends, without a browser. The
 * components only draw these. Names and numbers are invented (`n.37`).
 */

const FOAM: FormValues = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' };

describe('what the form starts with', () => {
  it('is empty for a new rate and the rate\'s own values for an edit', () => {
    expect(initialValues(null)).toEqual({ name: '', unit: '', defaultValue: '' });
    expect(initialValues(FOAM)).toEqual(FOAM);
  });
});

describe('the checks before anything is sent', () => {
  it('asks for a name, a unit and a value, each in its own words, when a new rate is empty', () => {
    expect(formProblems(initialValues(null), null)).toEqual({ name: NAME_REQUIRED_MESSAGE, unit: UNIT_REQUIRED_MESSAGE, defaultValue: DEFAULT_VALUE_MESSAGE });
  });

  it('accepts a complete new rate', () => {
    expect(formProblems({ name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' }, null)).toEqual({});
  });

  it('QLT-12: in an edit the default value is checked only when it was changed: a value stored with more than two decimals does not stop a rename', () => {
    const stored: FormValues = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.3745' };
    expect(formProblems({ ...stored, name: 'Foam-Cost-per-sqft' }, stored)).toEqual({});
    expect(formProblems({ ...stored, defaultValue: '21.3746' }, stored)).toEqual({ defaultValue: DEFAULT_VALUE_MESSAGE });
    expect(formProblems({ ...stored, defaultValue: '21.37' }, stored)).toEqual({});
  });

  it('QLT-12: an edit still checks the name and the unit', () => {
    expect(formProblems({ ...FOAM, name: '  ', unit: '' }, FOAM)).toEqual({ name: NAME_REQUIRED_MESSAGE, unit: UNIT_REQUIRED_MESSAGE });
  });
});

describe('what an edit changes (AC-3)', () => {
  it('is nothing for a form left as it was, for spaces around the name, and for another spelling of the same number', () => {
    expect(editChanges(FOAM, FOAM)).toEqual({});
    expect(editChanges(FOAM, { ...FOAM, name: '  Foam Cost ' })).toEqual({});
    expect(editChanges(FOAM, { ...FOAM, defaultValue: '021.37' })).toEqual({});
  });

  it('is exactly the fields that differ: the name by its letters (a change of letter case counts), the unit, the value as stored text', () => {
    expect(editChanges(FOAM, { ...FOAM, name: 'foam cost' })).toEqual({ name: 'foam cost' });
    expect(editChanges(FOAM, { ...FOAM, unit: 'per kg' })).toEqual({ unit: 'per kg' });
    expect(editChanges(FOAM, { ...FOAM, defaultValue: '22.5' })).toEqual({ defaultValue: '22.50' });
    expect(editChanges(FOAM, { name: 'Foam', unit: '%', defaultValue: '0' })).toEqual({ name: 'Foam', unit: '%', defaultValue: '0.00' });
  });

  it('is the same rule on the server: changesFrom ignores a field that is not given and one that is the same', () => {
    expect(changesFrom(FOAM, {})).toEqual({});
    expect(changesFrom(FOAM, { name: undefined, unit: 'per sq ft', defaultValue: '21.37' })).toEqual({});
    expect(changesFrom(FOAM, { defaultValue: '7.37' })).toEqual({ defaultValue: '7.37' });
  });

  it('writes a new rate with the name trimmed and the value as stored text', () => {
    expect(newRateBody({ name: '  Buffing-rate-per-sqin ', unit: 'per sq in', defaultValue: '1.5' })).toEqual({ name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.50' });
  });
});

describe('small helpers', () => {
  it('drops the message of the field the person has changed, and no other', () => {
    expect(withoutError({ name: 'a', unit: 'b' }, 'name')).toEqual({ unit: 'b' });
  });

  it('STD-05: the sign beside a value is one rule: "%" for a percentage rate, the rupee sign for any other, and the label follows it', () => {
    expect(valueSymbol('%')).toBe('%');
    expect(valueSymbol('per kg')).toBe('₹');
    expect(unitLabel('per kg')).toBe('₹ per kg');
    expect(unitLabel('%')).toBe('%');
  });
});
