import { describe, expect, it } from 'vitest';

import { deleteField } from '@/lib/config/field-delete';
import { insertFields } from '@/lib/config/field-insert';
import { withFormula } from '@/lib/config/formula-edit';
import {
  describeRevertAfter,
  describeRevertBefore,
  documentsEqual,
  planRevert,
  revertAuditObjectLabel,
  revertReason,
  unusableMessage,
  type RevertVersion,
} from '@/lib/config/revert';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';

import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.06 AC-4, AC-5, AC-7 and AC-8 (FR-078, FR-077; SPEC section 14 item 8), the pure core of a revert, with no database. The property: **a revert stores exactly the target's snapshot**, for every pair of
 * versions of a real chain built with the real edits (an insert, a formula change, a delete), and a target that equals the current configuration is "nothing to revert". The chain is the story's own: a checkpoint on
 * one version, a formula edit after it, the revert, and the undo.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const AL = seedFieldAt('AL');

function insertedDocument(from: ConfigDocument): ConfigDocument {
  const result = insertFields({ document: from, rates: RATES, spec: inputAfterAx({ label: 'Invented Revert Input' }) });
  if (!result.ok) throw new Error('The invented insert was refused.');
  return result.document;
}

function deletedDocument(from: ConfigDocument, fieldId: string): ConfigDocument {
  const result = deleteField({ document: from, rates: RATES, fieldId });
  if (!result.ok) throw new Error('The invented delete was refused.');
  return result.document;
}

/** Four versions made as the services make them: the seed, an insert, the delete of the inserted field (which gives back the first one's content) and a formula change. */
function chain(): RevertVersion[] {
  const v1 = seedConfig;
  const v2 = insertedDocument(v1);
  const insertedId = defined(v2.fields.find((field) => field.label === 'Invented Revert Input')).id;
  const v3 = deletedDocument(v2, insertedId);
  const v4 = parseConfigDocument(withFormula(v3, AL.id, `${defined(AL.kind === 'output' ? AL.formula : null)} * 2`));
  return [v1, v2, v3, v4].map((snapshot, index) => ({ id: `00000000-0000-4000-8000-0ccc0000000${String(index + 1)}`, number: index + 1, snapshot: structuredClone(snapshot) }));
}

describe('documentsEqual', () => {
  it('is a deep comparison that ignores the order of keys and not the order of items', () => {
    expect(documentsEqual({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true);
    expect(documentsEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(documentsEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(documentsEqual({ a: 1 }, { a: '1' })).toBe(false);
    expect(documentsEqual(null, {})).toBe(false);
    expect(documentsEqual([], {})).toBe(false);
    expect(documentsEqual('x', 'x')).toBe(true);
  });
});

describe('AC-4: a revert stores exactly the target\'s snapshot', () => {
  const versions = chain();

  it('for every ordered pair of versions whose content differs, the plan stores a deep copy of the target', () => {
    let planned = 0;
    for (const current of versions) {
      for (const target of versions) {
        const plan = planRevert({ current, target, document: parseConfigDocument(target.snapshot), rates: RATES });
        if (documentsEqual(current.snapshot, target.snapshot)) {
          expect(plan, `${String(current.number)} -> ${String(target.number)}`).toEqual({ ok: false, reason: 'nothing-to-revert' });
          continue;
        }
        expect(plan.ok, `${String(current.number)} -> ${String(target.number)}`).toBe(true);
        if (plan.ok) {
          expect(plan.snapshot).toEqual(target.snapshot);
          planned += 1;
        }
      }
    }
    // Versions 1 and 3 hold the same content (an insert followed by the delete of it gives the original back), so ten of the sixteen ordered pairs differ.
    expect(planned).toBe(10);
  });

  it('a target that is the current version, or has its content, is "nothing to revert" and is decided before the rates are looked at', () => {
    const [first, , third] = versions;
    const same = planRevert({ current: defined(third), target: defined(first), document: parseConfigDocument(defined(first).snapshot), rates: [] });
    expect(same).toEqual({ ok: false, reason: 'nothing-to-revert' });
    const itself = planRevert({ current: defined(first), target: defined(first), document: parseConfigDocument(defined(first).snapshot), rates: [] });
    expect(itself).toEqual({ ok: false, reason: 'nothing-to-revert' });
  });

  it('the story\'s chain: a checkpoint on 7, a change makes 8, the revert makes 9 equal to 7, the undo makes 10 equal to 8', () => {
    const [, seven, , eight] = versions;
    const sevenV = defined(seven);
    const eightV = defined(eight);
    const revert = planRevert({ current: eightV, target: sevenV, document: parseConfigDocument(sevenV.snapshot), rates: RATES });
    if (!revert.ok) throw new Error('The revert was refused.');
    const nine: RevertVersion = { id: 'nine', number: 9, snapshot: revert.snapshot };
    expect(nine.snapshot).toEqual(sevenV.snapshot);
    const undo = planRevert({ current: nine, target: eightV, document: parseConfigDocument(eightV.snapshot), rates: RATES });
    if (!undo.ok) throw new Error('The undo was refused.');
    expect(undo.snapshot).toEqual(eightV.snapshot);
    // A revert now to 7 is nothing to revert while 9 is current.
    expect(planRevert({ current: nine, target: sevenV, document: parseConfigDocument(sevenV.snapshot), rates: RATES })).toEqual({ ok: false, reason: 'nothing-to-revert' });
  });
});

describe('AC-5: a target that can still be used', () => {
  /** The target is a version stored while every rate existed; the current one differs from it, so the revert is not a no-op. */
  const target: RevertVersion = { id: 'target', number: 3, snapshot: structuredClone(seedConfig) };
  const current: RevertVersion = { id: 'current', number: 4, snapshot: { ...structuredClone(seedConfig), sections: [] } };

  it('every formula that names a rate the Process master still has is usable', () => {
    expect(planRevert({ current, target, document: parseConfigDocument(target.snapshot), rates: RATES }).ok).toBe(true);
  });

  it('a rate removed since names each field whose formula reads it, by letter and label, and nothing is planned', () => {
    const withoutCutting = RATES.filter((rate) => rate.name !== 'Cutting-Rate-per-Sec');
    const plan = planRevert({ current, target, document: parseConfigDocument(target.snapshot), rates: withoutCutting });
    expect(plan.ok).toBe(false);
    if (plan.ok || plan.reason !== 'unusable') throw new Error('The target should be unusable.');
    expect(plan.fields.length).toBeGreaterThan(0);
    expect(plan.fields.map((field) => field.letter)).toContain('AL');
    for (const field of plan.fields) {
      expect(field.letter).toMatch(/^[A-Z]{1,3}$/);
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it('the words name the field and give no rate name or value', () => {
    expect(unusableMessage({ letter: 'AL', label: 'Cutting Cost' })).toBe('AL Cutting Cost uses a rate that is no longer in the Process master.');
    expect(unusableMessage({ letter: 'AL', label: 'Cutting Cost' })).not.toMatch(/Cutting-Rate|\d/);
  });
});

describe('AC-8: the audit words', () => {
  it('names the checkpoint when the target has one, and the version when it has not', () => {
    expect(revertAuditObjectLabel('Before AY insert', 7)).toBe('Checkpoint "Before AY insert"');
    expect(revertAuditObjectLabel(null, 8)).toBe('Version 8');
    expect(revertAuditObjectLabel('x'.repeat(300), 7).length).toBeLessThanOrEqual(200);
  });

  it('before reads "Version 8" and after reads "Version 9 (from version 7)"', () => {
    expect(describeRevertBefore({ version: 8 })).toBe('Version 8');
    expect(describeRevertAfter({ version: 9, copiedFrom: 7 })).toBe('Version 9 (from version 7)');
  });

  it('the reason of the new version says what it was made from', () => {
    expect(revertReason('Before AY insert', 7)).toBe('Reverted to checkpoint "Before AY insert" (version 7)');
    expect(revertReason(null, 8)).toBe('Reverted to version 8');
  });
});
