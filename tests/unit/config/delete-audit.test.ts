import { describe, expect, it } from 'vitest';

import { deleteAuditAfter, deleteAuditBefore } from '@/lib/config/field-delete-audit';
import { blockedSentence, canEditUse, plainUse, usageTitle, type FieldUse } from '@/lib/fields/uses';
import { deletedMessage, deleteVersionChangedMessage, movedLeftWords } from '@/lib/config/field-delete-words';
import { AUDIT_EVENTS } from '@/server/services/audit-events';

/**
 * STORY-08.04 AC-2, AC-3 and AC-8: the words and the shapes of the field delete. The entry keeps who and when through its own columns, the deleted column (letter, label, kind, and the formula of an output in
 * display form, because the log is read by the Admin alone, NFR-002) and what moved, as runs of the old letters. It has no key a password or a figure could sit in.
 */

const FORMULA_USE: FieldUse = { kind: 'formula', fieldId: 'f1', letter: 'AY', label: 'Total Process Cost', formula: 'AL + AM' };
const HIDE_USE: FieldUse = { kind: 'hide-when-zero', fieldId: 'f2', letter: 'AM', label: 'Bending Cost' };
const VISIBLE_USE: FieldUse = { kind: 'visibility-rule', fieldId: 'f3', letter: 'AP', label: 'Notch Count' };
const TOTAL_USE: FieldUse = { kind: 'stage-total', stageId: 's3', number: 3, name: 'Process Costs' };

describe('AC-2: the sentences of the blocked state', () => {
  it('says how many formulas use the field, in the story\'s words: "1 formula uses this field." and "N formulas use this field."', () => {
    expect(blockedSentence('AL', 'Cutting Cost', [FORMULA_USE])).toBe('Cannot delete AL Cutting Cost yet. 1 formula uses this field.');
    expect(blockedSentence('AL', 'Cutting Cost', [FORMULA_USE, { ...FORMULA_USE, fieldId: 'f9' }])).toBe('Cannot delete AL Cutting Cost yet. 2 formulas use this field.');
  });

  it('says "place" and not "formula" when something other than a formula uses it', () => {
    expect(blockedSentence('AL', 'Cutting Cost', [HIDE_USE])).toBe('Cannot delete AL Cutting Cost yet. 1 place uses this field.');
    expect(blockedSentence('AL', 'Cutting Cost', [FORMULA_USE, TOTAL_USE, VISIBLE_USE])).toBe('Cannot delete AL Cutting Cost yet. 3 places use this field.');
  });

  it('names a use by what it is: a formula by its column, a rule by whose rule it is, a total by its stage', () => {
    expect(usageTitle(FORMULA_USE)).toBe('AY Total Process Cost');
    expect(usageTitle(HIDE_USE)).toBe('The hide-when-zero rule of AM Bending Cost');
    expect(usageTitle(VISIBLE_USE)).toBe('The visibility rule of AP Notch Count');
    expect(usageTitle(TOTAL_USE)).toBe('The total of stage 3');
  });

  it('offers Edit for a formula alone: the rest cannot be changed in the portal yet (OQ-2)', () => {
    expect([FORMULA_USE, HIDE_USE, VISIBLE_USE, TOTAL_USE].map(canEditUse)).toEqual([true, false, false, false]);
  });

  it('copies a use key by key, so a record with more in it never reaches a body', () => {
    const rich = { ...FORMULA_USE, secret: 'x' } as FieldUse;
    expect(plainUse(rich)).toEqual(FORMULA_USE);
    expect(plainUse({ ...TOTAL_USE, extra: 1 } as FieldUse)).toEqual(TOTAL_USE);
  });
});

describe('AC-3: the success and the stale words', () => {
  it('says "Field deleted. Configuration version 11."', () => {
    expect(deletedMessage(11)).toBe('Field deleted. Configuration version 11.');
  });

  it('tells the Admin the field was not deleted when the version moved on, with the number of the newer one', () => {
    expect(deleteVersionChangedMessage(12)).toMatch(/configuration version 12/);
    expect(deleteVersionChangedMessage(12)).toMatch(/not deleted/);
  });

  it('words a run of moved columns to the left: one column, a range, and two places', () => {
    expect(movedLeftWords('BP', 'BP', 1)).toBe('Column BP moved one to the left');
    expect(movedLeftWords('AZ', 'BP', 1)).toBe('Columns AZ to BP moved one to the left');
    expect(movedLeftWords('AZ', 'BP', 2)).toBe('Columns AZ to BP moved two to the left');
  });
});

describe('AC-8: the audit entry of a delete', () => {
  const event = AUDIT_EVENTS['config.field_deleted'];
  const DELETED_OUTPUT = { id: 'x', letter: 'AY', label: 'Cutting Cost', kind: 'output', formula: 'P * Cutting-Rate-per-Sec' } as const;
  const DELETED_INPUT = { id: 'y', letter: 'AY', label: 'Notch Count', kind: 'input', formula: null } as const;

  it('is wired, in the "Configuration change" category, about a field', () => {
    expect(event).toMatchObject({ status: 'wired', category: 'config_change', objectType: 'field' });
  });

  it('says the column and its formula before, and what moved after, with the version it made (the story\'s proposed words)', () => {
    expect(event.describeStored(deleteAuditBefore(DELETED_OUTPUT), { moved: [{ from: 'AZ', to: 'BP', by: 1 }], version: 11 })).toEqual({
      before: 'Column AY, Cutting Cost, formula P * Cutting-Rate-per-Sec',
      after: 'Deleted. Columns AZ to BP moved one to the left (configuration version 11)',
    });
  });

  it('has no formula part for an input, and says so when nothing moved (the last column was deleted)', () => {
    expect(event.describeStored(deleteAuditBefore(DELETED_INPUT), { moved: [], version: 12 })).toEqual({
      before: 'Column AY, Notch Count',
      after: 'Deleted. No other column moved (configuration version 12)',
    });
  });

  it('keeps what the story names and nothing else: before holds the column, after the moved runs and the version', () => {
    expect(deleteAuditBefore(DELETED_OUTPUT)).toEqual({ letter: 'AY', label: 'Cutting Cost', kind: 'output', formula: 'P * Cutting-Rate-per-Sec' });
    const changes = { inserted: [], moved: [{ id: 'a', label: 'A', from: 'AZ', to: 'AY' }, { id: 'b', label: 'B', from: 'BA', to: 'AZ' }, { id: 'c', label: 'C', from: 'BC', to: 'BB' }], productCells: [] };
    expect(deleteAuditAfter(changes, 11)).toEqual({
      moved: [
        { from: 'AZ', to: 'BA', by: 1 },
        { from: 'BC', to: 'BC', by: 1 },
      ],
      version: 11,
    });
  });

  it('accepts the shapes it makes and refuses an extra key, a password or a figure, in either value', () => {
    expect(event.before.safeParse(deleteAuditBefore(DELETED_OUTPUT)).success).toBe(true);
    expect(event.after.safeParse({ moved: [], version: 2 }).success).toBe(true);
    expect(event.before.safeParse({ ...deleteAuditBefore(DELETED_OUTPUT), password: 'x' }).success).toBe(false);
    expect(event.after.safeParse({ moved: [], version: 2, password: 'x' }).success).toBe(false);
    expect(event.after.safeParse({ moved: [{ from: 'AZ', to: 'BP', by: 1, rate: 2 }], version: 2 }).success).toBe(false);
    expect(event.before.safeParse(null).success).toBe(false);
  });

  it('keeps the whole formula, however long it is (the log is read by the Admin alone, as the formula change keeps it)', () => {
    const long = `P * ${'Cutting-Rate-per-Sec + '.repeat(120)}1`;
    expect(event.before.safeParse(deleteAuditBefore({ ...DELETED_OUTPUT, formula: long })).success).toBe(true);
  });
});
