import { describe, expect, it } from 'vitest';

import { AUDIT_CATEGORIES, auditCategoryLabel } from '@/lib/audit/categories';
import { MAX_ENTRY_FIELDS } from '@/lib/estimate/input-change';
import { AUDIT_EVENTS, eventsInCategory } from '@/server/services/audit-events';

/**
 * DEF-131 stage 2 (architecture note lead-admin-input-edit-2026-11-27, sections 3.4 and 3.9; ED-14): the four events a Lead's or an Admin's change of inputs, pictures and tree writes as audit entries, all in the
 * new category "Input change". What is pinned here is what a screen and a log can rely on: the shapes (strict, so no figure, rate or formula has a key to sit in), the cap of 100 rows on a delete and the words
 * the Admin reads on SCR-16. The writes themselves are `tests/integration/estimates/input-audit.test.ts`. Every name is invented.
 */

const PART = { slNo: '1.4', name: 'Top cover', kind: 'PART' } as const;
const FIELD = { letter: 'J', label: 'Length', value: '480.00' };

describe('ED-14: the category and the four events', () => {
  it('offers "Input change" last in the filter, with the four events behind it', () => {
    expect(AUDIT_CATEGORIES.at(-1)).toEqual({ id: 'input_change', label: 'Input change' });
    expect(auditCategoryLabel('input_change')).toBe('Input change');
    expect(eventsInCategory('input_change')).toEqual(['estimate.inputs_changed', 'estimate.part_added', 'estimate.part_moved', 'estimate.part_deleted']);
    for (const name of eventsInCategory('input_change')) expect(AUDIT_EVENTS[name]).toMatchObject({ status: 'wired', objectType: 'estimate' });
  });
});

describe('ED-14: estimate.inputs_changed', () => {
  const event = AUDIT_EVENTS['estimate.inputs_changed'];
  const before = { part: { slNo: '1.4', name: 'Top cover' }, fields: [{ letter: 'J', label: 'Length', value: '450.00' }] };
  const after = { actorRole: 'LEAD', part: { slNo: '1.4', name: 'Top cover' }, fields: [FIELD] };

  it('accepts the part and the changed fields, with the role of the actor in the after state', () => {
    expect(event.before.safeParse(before).success).toBe(true);
    expect(event.after.safeParse(after).success).toBe(true);
    expect(event.after.safeParse({ ...after, actorRole: 'ADMIN' }).success).toBe(true);
  });

  it('holds every field a save can carry (64 values and the fields a rule zeroes beside them), and not an unbounded list (QLT-805-04)', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => ({ letter: 'J', label: `Field ${String(index)}`, value: '1.00' }));
    expect(event.after.safeParse({ ...after, fields: many(64) }).success).toBe(true);
    expect(event.after.safeParse({ ...after, fields: many(MAX_ENTRY_FIELDS) }).success).toBe(true);
    expect(event.after.safeParse({ ...after, fields: many(MAX_ENTRY_FIELDS + 1) }).success).toBe(false);
    expect(event.before.safeParse({ ...before, fields: many(64) }).success).toBe(true);
  });

  it('refuses an Engineer as the actor, a key that is not in the shape, and a figure key anywhere', () => {
    expect(event.after.safeParse({ ...after, actorRole: 'ENGINEER' }).success).toBe(false);
    expect(event.after.safeParse({ ...after, total: '12.00' }).success).toBe(false);
    expect(event.before.safeParse({ ...before, rate: '9.00' }).success).toBe(false);
    expect(event.after.safeParse({ ...after, fields: [{ ...FIELD, rate: '9.00' }] }).success).toBe(false);
    expect(event.after.safeParse({ ...after, fields: [] }).success).toBe(false);
  });

  it('says part and fields in words: a blank is "Not entered", and the two columns are the same fields', () => {
    const text = event.describeStored(
      { part: { slNo: '1.4', name: 'Top cover' }, fields: [{ letter: 'J', label: 'Length', value: null }, { letter: 'K', label: 'Width', value: '10.00' }] },
      { actorRole: 'LEAD', part: { slNo: '1.4', name: 'Top cover' }, fields: [{ letter: 'J', label: 'Length', value: '480.00' }, { letter: 'K', label: 'Width', value: '12.00' }] },
    );
    expect(text).toEqual({ before: '1.4 Top cover: Length Not entered; Width 10.00', after: '1.4 Top cover: Length 480.00; Width 12.00' });
  });

  it('names a row with no name by its number alone', () => {
    const text = event.describeStored({ part: { slNo: '2', name: '' }, fields: [{ letter: 'J', label: 'Length', value: '1.00' }] }, { actorRole: 'ADMIN', part: { slNo: '2', name: '' }, fields: [FIELD] });
    expect(text?.after).toBe('2: Length 480.00');
  });
});

describe('ED-14: estimate.part_added', () => {
  const event = AUDIT_EVENTS['estimate.part_added'];

  it('keeps the new row (number and kind) and its parent (number and name), or none at the top', () => {
    expect(event.before.safeParse({}).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'LEAD', part: { slNo: '1.4', kind: 'SUB_ASSEMBLY' }, parent: { slNo: '1', name: 'Frame' } }).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'ADMIN', part: { slNo: '2', kind: 'MAIN_ASSEMBLY' }, parent: null }).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'ENGINEER', part: { slNo: '2', kind: 'MAIN_ASSEMBLY' }, parent: null }).success).toBe(false);
    expect(event.after.safeParse({ actorRole: 'LEAD', part: { slNo: '2', kind: 'WIDGET' }, parent: null }).success).toBe(false);
    expect(event.before.safeParse({ part: PART }).success).toBe(false);
  });

  it('says what was added and where', () => {
    expect(event.describeStored({}, { actorRole: 'LEAD', part: { slNo: '1.4', kind: 'SUB_ASSEMBLY' }, parent: { slNo: '1', name: 'Frame' } })).toEqual({ before: '—', after: 'Added Sub-Assembly 1.4 under 1 Frame' });
    expect(event.describeStored({}, { actorRole: 'LEAD', part: { slNo: '2', kind: 'MAIN_ASSEMBLY' }, parent: null })?.after).toBe('Added Main Assembly 2 at the top');
  });
});

describe('ED-14: estimate.part_moved', () => {
  const event = AUDIT_EVENTS['estimate.part_moved'];

  it('keeps the row before and after the move, with its number after', () => {
    expect(event.before.safeParse({ part: PART }).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'LEAD', part: { ...PART, slNo: '1.2' } }).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'LEAD', part: { ...PART, extra: 1 } }).success).toBe(false);
  });

  it('says from which number to which', () => {
    expect(event.describeStored({ part: PART }, { actorRole: 'LEAD', part: { ...PART, slNo: '1.2' } })).toEqual({ before: '1.4 Top cover', after: 'Moved 1.4 Top cover to 1.2' });
  });
});

describe('ED-14: estimate.part_deleted', () => {
  const event = AUDIT_EVENTS['estimate.part_deleted'];
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ slNo: `1.${String(index + 1)}`, name: '', kind: 'PART' as const }));

  it('keeps the root row, the count, and a list of at most 100 rows, marked when it is cut', () => {
    expect(event.before.safeParse({ part: PART, rows: 3, list: rows(3) }).success).toBe(true);
    expect(event.before.safeParse({ part: PART, rows: 150, list: rows(100), truncated: true }).success).toBe(true);
    expect(event.before.safeParse({ part: PART, rows: 101, list: rows(101), truncated: true }).success).toBe(false);
    expect(event.before.safeParse({ part: PART, rows: 3, list: rows(3), truncated: false }).success).toBe(false);
    expect(event.after.safeParse({ actorRole: 'ADMIN' }).success).toBe(true);
    expect(event.after.safeParse({ actorRole: 'ENGINEER' }).success).toBe(false);
  });

  it('holds no input value of a deleted row: a list entry has a number, a name and a kind and nothing else', () => {
    expect(event.before.safeParse({ part: PART, rows: 1, list: [{ ...rows(1)[0], inputs: { J: '1' } }] }).success).toBe(false);
  });

  it('says how many rows went with the root', () => {
    expect(event.describeStored({ part: PART, rows: 4, list: rows(4) }, { actorRole: 'LEAD' })).toEqual({ before: '1.4 Top cover and 3 rows under it', after: 'Deleted 1.4 Top cover and 3 rows under it' });
    expect(event.describeStored({ part: PART, rows: 2, list: rows(2) }, { actorRole: 'LEAD' })?.after).toBe('Deleted 1.4 Top cover and 1 row under it');
    expect(event.describeStored({ part: PART, rows: 1, list: rows(1) }, { actorRole: 'LEAD' })?.after).toBe('Deleted 1.4 Top cover');
  });
});
