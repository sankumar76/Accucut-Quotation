import { describe, expect, it } from 'vitest';

import { insertFields, type InsertSpec } from '@/lib/config/field-insert';
import { deleteField, fieldUses } from '@/lib/config/field-delete';
import { fieldLetter, findFieldById } from '@/lib/fields/registry';
import { isProtectedField } from '@/lib/fields/protected';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';
import { Decimal, type Value } from '@/lib/decimal';
import { compilePlan, createRateLookup, evaluateProductFormulas, evaluateRowFormulas, type Resolver } from '@/lib/formula';

import { defined } from '../../support/defined';
import { newInput, newOutput, outputDetails, fieldIdAt } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.04 AC-2, AC-5, AC-6 (FR-075, FR-076; BR-035; SPEC sections 8.3 and 14 item 7; architecture section 4.5 "Field delete checks all four"): the pure delete, against the real seed registry. The property
 * tests run **every** column of the seed through the delete and show that a protected one is refused, a referenced one is refused with what uses it, and an unreferenced one is removed with every later
 * letter one lower, no stored formula rewritten and every other formula giving the same value; and that an insert followed by a delete of the same field gives the original document back, at every place and in
 * every shape. The references are checked against an oracle that reads the stored text for `{{f:<id>}}` and the rule fields directly, never through the formula tokenizer the code under test uses.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const FIELD_COUNT = seedConfig.fields.length;

/** Who uses a field, by reading the four places the architecture names (section 4.5) the plain way. */
function oracle(document: ConfigDocument, id: string): string[] {
  const used: string[] = [];
  for (const field of document.fields) {
    if (field.id === id) continue;
    if (field.kind === 'output' && field.formula !== null && field.formula.includes(`{{f:${id}}}`)) used.push(`formula:${field.id}`);
    if (field.kind === 'output' && field.hideWhenZero === id) used.push(`hide:${field.id}`);
    if (field.kind === 'input' && field.visibleWhen?.fieldId === id) used.push(`visible:${field.id}`);
  }
  for (const stage of document.stages) if (stage.totalFieldIds.includes(id)) used.push(`total:${stage.id}`);
  return used.sort();
}

const keyOfUse = (use: ReturnType<typeof fieldUses>[number]): string => {
  switch (use.kind) {
    case 'formula':
      return `formula:${use.fieldId}`;
    case 'hide-when-zero':
      return `hide:${use.fieldId}`;
    case 'visibility-rule':
      return `visible:${use.fieldId}`;
    case 'stage-total':
      return `total:${use.stageId}`;
  }
};

describe('AC-2 (SPEC section 14 item 7): what uses a field', () => {
  it('finds exactly what the oracle finds for every one of the seed fields, in all four places', () => {
    let referenced = 0;
    for (const field of seedConfig.fields) {
      const uses = fieldUses(seedConfig, RATES, field.id);
      expect(uses.map(keyOfUse).sort(), `${field.key}`).toEqual(oracle(seedConfig, field.id));
      if (uses.length > 0) referenced += 1;
    }
    // The seed has all four kinds of use, so the loop above covers each one at least once (checked below).
    expect(referenced).toBeGreaterThan(10);
  });

  it('knows each of the four kinds of use in the seed: a formula, a hide-when-zero rule, a visibility rule and a stage total', () => {
    const kinds = new Set(seedConfig.fields.flatMap((field) => fieldUses(seedConfig, RATES, field.id).map((use) => use.kind)));
    expect([...kinds].sort()).toEqual(['formula', 'hide-when-zero', 'stage-total', 'visibility-rule']);
  });

  it('names a formula by its column letter, its label and its text in display form, and lists formulas in column order, then the other uses', () => {
    const uses = fieldUses(seedConfig, RATES, seedFieldAt('AL').id);
    const formulas = uses.filter((use) => use.kind === 'formula');
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0]).toMatchObject({ kind: 'formula', letter: 'AY', label: seedFieldAt('AY').label, fieldId: seedFieldAt('AY').id });
    expect(formulas[0]?.kind === 'formula' && formulas[0].formula).toBe('AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX');
    const firstOther = uses.findIndex((use) => use.kind !== 'formula');
    if (firstOther !== -1) expect(uses.slice(firstOther).every((use) => use.kind !== 'formula')).toBe(true);
  });

  it('finds a field read through SUM(column) (the estimate total reads BG that way)', () => {
    const sums = seedConfig.fields.filter((field) => field.kind === 'output' && field.formula?.includes('SUM('));
    expect(sums.length).toBeGreaterThan(0);
    const sumOperand = /SUM\(\{\{f:([0-9a-f-]{36})\}\}\)/.exec(defined(sums[0]?.kind === 'output' ? sums[0].formula : null))?.[1];
    const uses = fieldUses(seedConfig, RATES, defined(sumOperand));
    expect(uses.some((use) => use.kind === 'formula' && use.fieldId === sums[0]?.id)).toBe(true);
  });

  it('finds a field that only a hide-when-zero rule uses (a pair whose cost formula does not read the new input), one that only a visibility rule uses, and one that only a stage total uses', () => {
    const pair = insertFields({
      document: seedConfig,
      rates: RATES,
      spec: { kind: 'pair', afterFieldId: fieldIdAt('AX'), input: newInput({ label: 'Invented Held' }), cost: { ...outputDetails({ formula: '1' }), afterFieldId: null, hideWhenInputIsZero: true } },
    });
    if (!pair.ok) throw new Error('refused');
    const [held, cost] = pair.inserted;
    expect(fieldUses(pair.document, RATES, defined(held).id)).toEqual([{ kind: 'hide-when-zero', fieldId: defined(cost).id, letter: 'AZ', label: 'Invented Notch Cost' }]);

    const watcher = insertFields({ document: pair.document, rates: RATES, spec: { kind: 'input', afterFieldId: defined(cost).id, input: newInput({ label: 'Invented Watcher', watchFieldId: defined(held).id }) } });
    if (!watcher.ok) throw new Error('refused');
    const rules = fieldUses(watcher.document, RATES, defined(held).id).map((use) => use.kind);
    expect(rules).toEqual(['hide-when-zero', 'visibility-rule']);

    // No seed output is free of use, so a stage total alone is made: a stage that totals the cost column no formula reads.
    const stage = defined(pair.document.stages.find((each) => each.id === defined(pair.document.fields.find((field) => field.id === defined(cost).id)).stageId));
    const totalled = parseConfigDocument({ ...pair.document, stages: pair.document.stages.map((each) => (each.id === stage.id ? { ...each, totalFieldIds: [...each.totalFieldIds, defined(cost).id] } : each)) });
    expect(fieldUses(totalled, RATES, defined(cost).id)).toEqual([{ kind: 'stage-total', stageId: stage.id, number: stage.number, name: stage.name }]);
  });

  it('does not count a field as using itself', () => {
    const document = seedConfig;
    for (const field of document.fields) expect(fieldUses(document, RATES, field.id).some((use) => use.kind !== 'stage-total' && use.fieldId === field.id)).toBe(false);
  });

  it('refuses nothing and shows nothing for an ID that is no field of the document', () => {
    expect(fieldUses(seedConfig, RATES, '00000000-0000-4000-8000-00000000dead')).toEqual([]);
  });
});

describe('AC-5: the protected fields', () => {
  it('protects every field with a system role and every field the code finds by key and would fail without', () => {
    const protectedLetters = seedConfig.fields.filter(isProtectedField).map((field) => fieldLetter(field));
    expect(protectedLetters).toEqual(expect.arrayContaining(['A', 'E', 'F', 'H', 'I', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO']));
    // Nothing else of the seed is protected: the delete is offered on every other column.
    expect(protectedLetters).toHaveLength(14);
  });

  it('refuses a protected field with the reason "protected", whatever else is true of it', () => {
    for (const field of seedConfig.fields.filter(isProtectedField)) {
      expect(deleteField({ document: seedConfig, rates: RATES, fieldId: field.id }), field.key).toEqual({ ok: false, reason: 'protected' });
    }
  });
});

describe('AC-2 and AC-3: the answer of a delete', () => {
  it('answers "not found" for an ID that is no field', () => {
    expect(deleteField({ document: seedConfig, rates: RATES, fieldId: '00000000-0000-4000-8000-00000000dead' })).toEqual({ ok: false, reason: 'not-found' });
  });

  it('refuses a field that is used, with every use, and stores nothing (the document is not touched)', () => {
    const before = structuredClone(seedConfig);
    const result = deleteField({ document: seedConfig, rates: RATES, fieldId: seedFieldAt('AL').id });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'in-use' });
    expect(result.ok === false && result.reason === 'in-use' && result.uses.map(keyOfUse).sort()).toEqual(oracle(seedConfig, seedFieldAt('AL').id));
    expect(seedConfig).toEqual(before);
  });
});

/** Every typed value is the same fixed, different number per field, so a column read from the wrong place changes a result. */
function resolverFor(document: ConfigDocument): Resolver {
  const values = new Map<string, Decimal>();
  document.fields.forEach((field) => {
    if (field.kind !== 'output') values.set(field.id, new Decimal(2 + (field.key.length % 7) + (field.key.charCodeAt(0) % 5) / 4));
  });
  return {
    fieldValue: (fieldId) => values.get(fieldId) ?? null,
    columnValues: () => [new Decimal(3), new Decimal(5)],
    rate: createRateLookup(SEED_PROCESS_ITEMS.map((item, index) => ({ id: item.id, name: item.name, value: new Decimal(1 + index / 8) }))),
    material: () => new Decimal(1.25),
    exchangeRate: (currency) => new Decimal(currency === 'USD' ? 83 : 90),
  };
}

function valuesOf(document: ConfigDocument): Map<string, string | null> {
  const plan = compilePlan(document.fields);
  const resolver = resolverFor(document);
  const results = new Map<string, Value>([...evaluateRowFormulas(plan, resolver), ...evaluateProductFormulas(plan, resolver)]);
  return new Map([...results].map(([id, value]) => [id, value === null ? null : value.toString()]));
}

describe('AC-6 (FR-075, BR-035): deleting an unreferenced field re-letters the rest and keeps every value', () => {
  const unreferenced = seedConfig.fields.filter((field) => !isProtectedField(field) && oracle(seedConfig, field.id).length === 0);
  const before = valuesOf(seedConfig);

  it('has unreferenced, unprotected seed fields to run the property over', () => {
    expect(unreferenced.length).toBeGreaterThan(5);
  });

  it('for each of them: positions 1 to N, every other field as it was, no stored formula rewritten, the same value for every other formula, and the letters shown are the letters stored', () => {
    for (const target of unreferenced) {
      const result = deleteField({ document: seedConfig, rates: RATES, fieldId: target.id });
      if (!result.ok) throw new Error(`${target.key} was refused: ${result.reason}`);
      const document = parseConfigDocument(result.document);

      expect(document.fields).toHaveLength(FIELD_COUNT - 1);
      expect(document.fields.map((field) => field.position)).toEqual(document.fields.map((_field, index) => index + 1));
      const kept = seedConfig.fields.filter((field) => field.id !== target.id);
      expect(document.fields.map((field) => field.id)).toEqual(kept.map((field) => field.id));
      document.fields.forEach((field, place) => expect({ ...field, position: 0 }, `${target.key}: ${field.key}`).toEqual({ ...defined(kept[place]), position: 0 }));
      const after = valuesOf(document);
      for (const old of kept) if (old.kind === 'output') expect(after.get(old.id), `${target.key}: ${old.key}`).toBe(before.get(old.id));
      for (const column of result.changes.moved) expect(fieldLetter(defined(findFieldById(document, column.id)))).toBe(column.to);
      // Only a column after the deleted one moves, and each moves one place to the left.
      expect(result.changes.moved.map((column) => column.id)).toEqual(kept.filter((field) => field.position > target.position).map((field) => field.id));
      expect(document.sections).toEqual(seedConfig.sections);
      // Stages differ only if a total held the deleted field, which no unreferenced field is.
      expect(document.stages).toEqual(seedConfig.stages);
    }
  });

  it('moves the product cells with their columns, found by what they are: a delete before BL moves BL2 to BK2', () => {
    const target = defined(unreferenced.find((field) => field.position < seedFieldAt('BL').position));
    const result = deleteField({ document: seedConfig, rates: RATES, fieldId: target.id });
    if (!result.ok) throw new Error('refused');
    expect(result.changes.productCells).toEqual(expect.arrayContaining([{ label: seedFieldAt('BL').label, from: 'BL2', to: 'BK2' }]));
    expect(result.changes.productCells.every((cell) => cell.to.endsWith('2') && cell.from.endsWith('2'))).toBe(true);
  });

  it('moves nothing when the last column is deleted, and answers what it deleted: its letter, label, kind and formula in display form', () => {
    const lastInserted = insertFields({ document: seedConfig, rates: RATES, spec: { kind: 'output', afterFieldId: fieldIdAt('BO'), output: newOutput({ label: 'Invented Last', formula: 'AL * 2' }) } });
    if (!lastInserted.ok) throw new Error('refused');
    const id = defined(lastInserted.inserted[0]).id;
    const result = deleteField({ document: lastInserted.document, rates: RATES, fieldId: id });
    if (!result.ok) throw new Error('refused');
    expect(result.changes.moved).toEqual([]);
    expect(result.deleted).toEqual({ id, letter: 'BP', label: 'Invented Last', kind: 'output', formula: 'AL * 2' });
    expect(result.document).toEqual(parseConfigDocument(seedConfig));
  });

  it('gives an input no formula part', () => {
    const target = defined(unreferenced.find((field) => field.kind === 'input'));
    const result = deleteField({ document: seedConfig, rates: RATES, fieldId: target.id });
    expect(result.ok && result.deleted).toMatchObject({ kind: 'input', formula: null, letter: fieldLetter(target) });
  });

  it('shows the deleted formula as the Admin read it, with letters and rate names', () => {
    const made = insertFields({ document: seedConfig, rates: RATES, spec: { kind: 'output', afterFieldId: fieldIdAt('AX'), output: newOutput({ formula: 'P * Cutting-Rate-per-Sec' }) } });
    if (!made.ok) throw new Error('refused');
    const result = deleteField({ document: made.document, rates: RATES, fieldId: defined(made.inserted[0]).id });
    expect(result.ok && result.deleted.formula).toBe('P * Cutting-Rate-per-Sec');
  });
});

describe('AC-6: an insert followed by a delete of the same field gives the original document back', () => {
  const original = parseConfigDocument(seedConfig);

  const SHAPES: ReadonlyArray<{ readonly name: string; readonly spec: (afterFieldId: string) => InsertSpec }> = [
    { name: 'an input', spec: (afterFieldId) => ({ kind: 'input', afterFieldId, input: newInput() }) },
    { name: 'an output', spec: (afterFieldId) => ({ kind: 'output', afterFieldId, output: newOutput() }) },
    { name: 'an input with its cost column', spec: (afterFieldId) => ({ kind: 'pair', afterFieldId, input: newInput(), cost: { ...outputDetails({ formula: '1' }), afterFieldId: null, hideWhenInputIsZero: true } }) },
  ];

  for (const shape of SHAPES) {
    it(`after each of the ${FIELD_COUNT} columns, ${shape.name}`, () => {
      let counter = 0;
      const newId = (): string => `00000000-0000-4000-9000-${String(counter++).padStart(12, '0')}`;
      for (const placed of seedConfig.fields) {
        const inserted = insertFields({ document: seedConfig, rates: RATES, spec: shape.spec(placed.id), newId });
        if (!inserted.ok) throw new Error('The insert was refused.');
        // A pair is taken out last-in first-out: the cost column (which holds the rule that names the input) and then the input.
        let document = inserted.document;
        for (const added of [...inserted.inserted].reverse()) {
          const deleted = deleteField({ document, rates: RATES, fieldId: added.id });
          if (!deleted.ok) throw new Error(`The delete was refused: ${deleted.reason}`);
          document = deleted.document;
        }
        expect(document, `after ${placed.key}`).toEqual(original);
      }
    });
  }
});

describe('AC-2: a pair\'s input is held by its cost column until that column is deleted', () => {
  it('refuses the input of a pair while the cost column hides itself on it, and names that rule', () => {
    const inserted = insertFields({
      document: seedConfig,
      rates: RATES,
      spec: { kind: 'pair', afterFieldId: fieldIdAt('AX'), input: newInput({ label: 'Invented Held' }), cost: { ...outputDetails({ formula: 'AY * 2' }), afterFieldId: null, hideWhenInputIsZero: true } },
    });
    if (!inserted.ok) throw new Error('refused');
    const [input, cost] = inserted.inserted;
    const refused = deleteField({ document: inserted.document, rates: RATES, fieldId: defined(input).id });
    expect(refused.ok === false && refused.reason === 'in-use' && refused.uses.map((use) => use.kind).sort()).toEqual(['formula', 'hide-when-zero']);
    const cleared = deleteField({ document: inserted.document, rates: RATES, fieldId: defined(cost).id });
    expect(cleared.ok).toBe(true);
  });
});
