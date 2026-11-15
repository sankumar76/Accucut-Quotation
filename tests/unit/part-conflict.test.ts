import { describe, expect, it } from 'vitest';

import type { FormField } from '@/lib/estimates/form-client';
import { planAfterNewerPart } from '@/lib/estimates/part-conflict';

/**
 * STORY-05.08 AC-5, AC-6: a save that the server refuses because the part moved on (409, a stale revision) must never be an overwrite and never drop what was typed. The plan is pure: of every field,
 * what the person changed (typed against what the screen last held) and what someone else changed (the part now against what the screen last held) decide it. A field only the person changed is sent
 * again with the new revision (nobody else touched it); a field only the other side changed is shown as it is now; a field both changed to different values keeps the person's text and is offered
 * against the newer one. Invented ids and values only.
 */

const field = (id: string, rule: FormField['rule'], defaultValue: string | null = null): Pick<FormField, 'id' | 'rule' | 'defaultValue' | 'editable'> => ({ id, rule, defaultValue, editable: true });

const LENGTH = field('length', { type: 'number', decimals: 2 });
const WIDTH = field('width', { type: 'number', decimals: 2 });
const PART_NO = field('part-no', { type: 'text', maxLength: 40, multiline: false });
const FASTENERS = field('fasteners', { type: 'text', maxLength: 40, multiline: false }, 'None');
const FIELDS = [LENGTH, WIDTH, PART_NO, FASTENERS];

const plan = (typed: Record<string, string>, held: Record<string, string>, fresh: Record<string, string>) => planAfterNewerPart({ fields: FIELDS, typed, held, fresh });

describe('AC-5: what the person changed and nobody else did is sent again, not lost and not asked about', () => {
  it('a field only this tab changed is sent again with the new revision', () => {
    expect(plan({ length: '12.5' }, {}, { width: '3.00' })).toEqual({ resend: ['length'], conflicts: [], adopt: { width: '3.00' } });
  });

  it('a change that is the same after normalisation is not a change', () => {
    expect(plan({ length: '1.5' }, { length: '1.50' }, { length: '1.50', width: '2.00' })).toEqual({ resend: [], conflicts: [], adopt: { width: '2.00' } });
  });
});

describe('AC-6: a field both sides changed is never overwritten without being shown', () => {
  it('keeps the typed text and offers the newer value when the two differ', () => {
    expect(plan({ length: '7' }, { length: '1.00' }, { length: '9.00' })).toEqual({ resend: [], conflicts: [{ fieldId: 'length', newer: '9.00' }], adopt: {} });
  });

  it('is no conflict when both sides arrived at the same value (1.5 and 1.50)', () => {
    expect(plan({ length: '1.5' }, { length: '1.00' }, { length: '1.50' })).toEqual({ resend: [], conflicts: [], adopt: {} });
  });

  it('a value the other side cleared is offered as blank, and a value this side cleared against a newer one is a conflict too', () => {
    expect(plan({ 'part-no': '' }, { 'part-no': 'FR-1' }, {})).toEqual({ resend: [], conflicts: [], adopt: {} });
    expect(plan({ 'part-no': 'FR-2' }, { 'part-no': 'FR-1' }, {})).toEqual({ resend: [], conflicts: [{ fieldId: 'part-no', newer: '' }], adopt: {} });
    expect(plan({ 'part-no': '' }, { 'part-no': 'FR-1' }, { 'part-no': 'FR-3' })).toEqual({ resend: [], conflicts: [{ fieldId: 'part-no', newer: 'FR-3' }], adopt: {} });
  });

  it('reads a blank over a default as the default, as a save does (Fasteners "None")', () => {
    expect(plan({ fasteners: '' }, {}, {})).toEqual({ resend: [], conflicts: [], adopt: {} });
    expect(plan({ fasteners: 'M6 bolts' }, {}, { fasteners: 'M8 bolts' })).toEqual({ resend: [], conflicts: [{ fieldId: 'fasteners', newer: 'M8 bolts' }], adopt: {} });
  });
});

describe('AC-5: a field the person did not change shows what the part holds now', () => {
  it('adopts the newer value, and a blank where the other side cleared it', () => {
    expect(plan({ width: '2.00', length: '1.00' }, { width: '2.00', length: '1.00' }, { width: '4.00' })).toEqual({ resend: [], conflicts: [], adopt: { width: '4.00', length: '' } });
  });

  it('leaves a field alone when neither side changed it', () => {
    expect(plan({ width: '2.00' }, { width: '2.00' }, { width: '2.00' })).toEqual({ resend: [], conflicts: [], adopt: {} });
  });

  it('does not touch a field the person typed something unreadable into: it keeps its message and is not sent', () => {
    expect(plan({ length: 'abc' }, {}, { length: '5.00' })).toEqual({ resend: [], conflicts: [], adopt: {} });
  });

  it('never plans for a field that cannot be typed into', () => {
    const derived: FormField['rule'] = { type: 'derived', from: null };
    expect(planAfterNewerPart({ fields: [{ id: 'sl-no', rule: derived, defaultValue: null, editable: false }], typed: { 'sl-no': '1' }, held: {}, fresh: { 'sl-no': '2' } })).toEqual({ resend: [], conflicts: [], adopt: {} });
  });
});
