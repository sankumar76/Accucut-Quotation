import { describe, expect, it } from 'vitest';

import { indexToColumnLetter } from '@/lib/columns';
import { insertFields, keyFor, previewInsert, previewLetters, type InsertSpec, type LetterChanges, type NewInput, type NewSingleOutput } from '@/lib/config/field-insert';
import { movedRuns } from '@/lib/config/field-insert-changes';
import { Decimal, type Value } from '@/lib/decimal';
import { fieldLetter, findFieldById, findSystemField } from '@/lib/fields/registry';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';
import { compilePlan, createRateLookup, evaluateProductFormulas, evaluateRowFormulas, toDisplayForm, type Resolver } from '@/lib/formula';

import { defined } from '../../support/defined';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.03 AC-3, AC-5, AC-6, AC-7 (FR-074, FR-075; BR-035, BR-038; SPEC sections 8.1, 8.3 and 14 item 6; decisions D-1 and D-2): the pure insert, against the real seed registry. The property test runs every
 * insert position and every shape (an input, an output, an input with its cost column) and shows that no field changes its ID, no stored formula is rewritten and every seeded formula gives the same value before
 * and after, with invented inputs.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const SECTION_TWO = defined(seedConfig.sections[1]).id;
const STAGE_PROCESS = defined(seedConfig.stages[2]);
const FIELD_COUNT = seedConfig.fields.length;

let counter = 0;
/** Repeatable IDs: a run of a test is the same every time. */
const newId = (): string => `00000000-0000-4000-9000-${String(counter++).padStart(12, '0')}`;

const input = (overrides: Partial<NewInput> = {}): NewInput => ({
  label: 'Notch Count',
  dataType: 'number',
  defaultValue: '',
  sectionId: SECTION_TWO,
  unit: '',
  hint: '',
  width: 12,
  numFmt: '0.00',
  watchFieldId: null,
  ...overrides,
});

const output = (overrides: Partial<NewSingleOutput> = {}): NewSingleOutput => ({
  label: 'Notch Cost',
  formula: '1',
  stageId: STAGE_PROCESS.id,
  group: 'Cutting',
  width: 14,
  numFmt: '#,##0.00',
  hideWhenZeroFieldId: null,
  ...overrides,
});

const after = (letter: string): string => seedFieldAt(letter).id;

function insert(spec: InsertSpec, document: ConfigDocument = seedConfig) {
  return insertFields({ document, rates: RATES, spec, newId });
}

function inserted(spec: InsertSpec, document: ConfigDocument = seedConfig) {
  const result = insert(spec, document);
  if (!result.ok) throw new Error(`The insert was refused: ${result.issues.map((issue) => `${issue.field}: ${issue.message}`).join(' | ')}`);
  return result;
}

describe('AC-3 (SPEC section 14 item 6): an input after AX is AY, and AY to BO become AZ to BP', () => {
  const result = inserted({ kind: 'input', afterFieldId: after('AX'), input: input() });

  it('names the new field AY, after AX', () => {
    expect(result.changes.inserted).toEqual([expect.objectContaining({ letter: 'AY', followsLetter: 'AX', label: 'Notch Count', kind: 'input' })]);
  });

  it('moves every column from AY to BO one place to the right, in order, and nothing before it', () => {
    const moved = result.changes.moved.map(({ from, to }) => `${from} → ${to}`);
    expect(moved).toHaveLength(seedFieldAt('BO').position - seedFieldAt('AY').position + 1);
    expect(moved[0]).toBe('AY → AZ');
    expect(moved[moved.length - 1]).toBe('BO → BP');
    expect(result.changes.moved.map((column) => column.label)[0]).toBe(seedFieldAt('AY').label);
  });

  it('moves the product cells with their columns, found by what they are and not by a letter: BL2 → BM2, BN2 → BO2, BO2 → BP2', () => {
    expect(result.changes.productCells.map(({ from, to }) => `${from} → ${to}`)).toEqual(['BL2 → BM2', 'BN2 → BO2', 'BO2 → BP2']);
  });

  it('shows the same letters as the letters-only list of step 2 (one function, no second copy)', () => {
    const letters = previewLetters(seedConfig, { kind: 'input', afterFieldId: after('AX'), input: input({ label: '' }) });
    expect(letters?.inserted.map((column) => column.letter)).toEqual(['AY']);
    expect(letters?.moved.map(({ from, to }) => `${from} → ${to}`)).toEqual(result.changes.moved.map(({ from, to }) => `${from} → ${to}`));
    expect(letters?.productCells).toEqual(result.changes.productCells);
  });

  it('is the same answer for the preview as for the save', () => {
    const preview = previewInsert({ document: seedConfig, rates: RATES, spec: { kind: 'input', afterFieldId: after('AX'), input: input() }, newId });
    const withoutIds = (changes: LetterChanges) => ({ ...changes, inserted: changes.inserted.map(({ label, kind, letter, followsLetter }) => ({ label, kind, letter, followsLetter })) });
    expect(preview.ok && withoutIds(preview.changes)).toEqual(withoutIds(result.changes));
  });
});

describe('AC-3 and AC-2: a pair shows both shifts in one table', () => {
  const spec: InsertSpec = { kind: 'pair', afterFieldId: after('AX'), input: input(), cost: { ...output({ formula: 'AY * 2' }), afterFieldId: null, hideWhenInputIsZero: true } };
  const result = inserted(spec);

  it('puts the input at AY and its cost column at AZ, and moves the rest two places (BL2 → BN2, BN2 → BP2, BO2 → BQ2)', () => {
    expect(result.changes.inserted.map((column) => column.letter)).toEqual(['AY', 'AZ']);
    expect(result.changes.moved[0]).toMatchObject({ from: 'AY', to: 'BA' });
    expect(result.changes.productCells.map(({ from, to }) => `${from} → ${to}`)).toEqual(['BL2 → BN2', 'BN2 → BP2', 'BO2 → BQ2']);
  });

  it('accepts a cost formula that names the new input by its new letter (decision D-1) and stores its ID', () => {
    const [newInput, newCost] = result.inserted;
    expect(defined(findFieldById(result.document, defined(newCost).id))).toMatchObject({ formula: `{{f:${defined(newInput).id}}} * 2`, hideWhenZero: defined(newInput).id });
    expect(result.formulas).toEqual([{ letter: 'AZ', label: 'Notch Cost', formula: 'AY * 2' }]);
  });

  it('puts the cost column after another column when asked, and shifts the stretch between by one and the rest by two', () => {
    const apart = inserted({ ...spec, cost: { ...spec.cost, afterFieldId: after('BA'), formula: 'AY * 2' } });
    expect(apart.changes.inserted.map((column) => column.letter)).toEqual(['AY', 'BC']);
    const runs = movedRuns(apart.changes.moved);
    expect(runs).toEqual([
      { from: 'AY', to: 'BA', by: 1 },
      { from: 'BB', to: 'BO', by: 2 },
    ]);
  });

  it('reads naming the input own column as the default: the cost column goes right after the input', () => {
    const same = inserted({ ...spec, cost: { ...spec.cost, afterFieldId: after('AX') } });
    expect(same.changes.inserted.map((column) => column.letter)).toEqual(['AY', 'AZ']);
  });
});

/** Every typed value is the same fixed, different number per field, so a field read from the wrong place changes a result. */
function resolverFor(document: ConfigDocument, extra: ReadonlyMap<string, Decimal> = new Map()): Resolver {
  const values = new Map<string, Decimal>();
  document.fields.forEach((field) => {
    if (field.kind !== 'output') values.set(field.id, new Decimal(2 + (field.key.length % 7) + (field.key.charCodeAt(0) % 5) / 4));
  });
  for (const [id, value] of extra) values.set(id, value);
  return {
    fieldValue: (fieldId) => values.get(fieldId) ?? null,
    columnValues: () => [new Decimal(3), new Decimal(5)],
    rate: createRateLookup(SEED_PROCESS_ITEMS.map((item, index) => ({ id: item.id, name: item.name, value: new Decimal(1 + index / 8) }))),
    material: () => new Decimal(1.25),
    exchangeRate: (currency) => new Decimal(currency === 'USD' ? 83 : 90),
  };
}

function valuesOf(document: ConfigDocument, extra?: ReadonlyMap<string, Decimal>): Map<string, string | null> {
  const plan = compilePlan(document.fields);
  const resolver = resolverFor(document, extra);
  const results = new Map<string, Value>([...evaluateRowFormulas(plan, resolver), ...evaluateProductFormulas(plan, resolver)]);
  return new Map([...results].map(([id, value]) => [id, value === null ? null : value.toString()]));
}

const SHAPES: ReadonlyArray<{ readonly name: string; readonly count: number; readonly spec: (afterFieldId: string) => InsertSpec }> = [
  { name: 'an input', count: 1, spec: (afterFieldId) => ({ kind: 'input', afterFieldId, input: input() }) },
  { name: 'an output', count: 1, spec: (afterFieldId) => ({ kind: 'output', afterFieldId, output: output() }) },
  { name: 'an input with its cost column', count: 2, spec: (afterFieldId) => ({ kind: 'pair', afterFieldId, input: input(), cost: { ...output({ formula: '1' }), afterFieldId: null, hideWhenInputIsZero: true } }) },
];

describe('AC-5 (BR-035): re-lettering keeps every result, at every insert position', () => {
  const before = valuesOf(seedConfig);

  for (const shape of SHAPES) {
    describe(`after each of the ${FIELD_COUNT} columns, ${shape.name}`, () => {
      it('renumbers 1 to N, keeps every ID in its order, rewrites no stored formula and gives every seeded formula the same value', () => {
        seedConfig.fields.forEach((placed, index) => {
          const result = inserted(shape.spec(placed.id));
          const document = parseConfigDocument(result.document);

          expect(document.fields.map((field) => field.position)).toEqual(document.fields.map((_, place) => place + 1));
          expect(document.fields).toHaveLength(FIELD_COUNT + shape.count);
          // Every old field keeps its ID, in order, and everything but its place is what it was: not a formula, not a label, not a flag.
          const kept = document.fields.filter((field) => seedConfig.fields.some((old) => old.id === field.id));
          expect(kept.map((field) => field.id)).toEqual(seedConfig.fields.map((field) => field.id));
          kept.forEach((field, place) => {
            expect({ ...field, position: 0 }, `${field.key} after ${index + 1}`).toEqual({ ...defined(seedConfig.fields[place]), position: 0 });
          });
          // The new fields sit right after the column they were put after (the cost column right after the input).
          const place = document.fields.findIndex((field) => field.id === placed.id);
          expect(document.fields.slice(place + 1, place + 1 + shape.count).map((field) => field.id)).toEqual(result.inserted.map((field) => field.id));
          // The same value for every seeded formula (the property the story exists for).
          const afterValues = valuesOf(document);
          for (const old of seedConfig.fields) if (old.kind === 'output') expect(afterValues.get(old.id), `${old.key} after ${index + 1}`).toBe(before.get(old.id));
          // The letters shown are the letters now: a moved column's new letter is its place in the new list.
          for (const column of result.changes.moved) expect(fieldLetter(defined(findFieldById(document, column.id)))).toBe(column.to);
          // Stages, sections and totals are untouched, and the new fields join no total (BR-038).
          expect(document.stages).toEqual(seedConfig.stages);
          expect(document.sections).toEqual(seedConfig.sections);
        });
      });
    });
  }

  it('shows every seeded formula in display form with the new letters and reads the same columns', () => {
    const result = inserted({ kind: 'input', afterFieldId: after('AX'), input: input() });
    const showBefore = (id: string, document: ConfigDocument): string => {
      const field = defined(findFieldById(document, id));
      return field.kind === 'output' && field.formula !== null ? toDisplayForm(field.formula, { fieldIds: document.fields.map((candidate) => candidate.id), rates: RATES }) : '';
    };
    expect(showBefore(seedFieldAt('BG').id, seedConfig)).toBe('BB + BC + BD + BE + BF');
    expect(showBefore(seedFieldAt('BG').id, result.document)).toBe('BC + BD + BE + BF + BG');
    expect(showBefore(seedFieldAt('AY').id, result.document)).toBe('AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX');
    expect(showBefore(seedFieldAt('BN').id, result.document)).toBe('BM / SUM(BN)');
  });

  it('inserts after the last column (nothing moves) and after the first (A)', () => {
    const last = inserted({ kind: 'input', afterFieldId: after('BO'), input: input() });
    expect(last.changes.moved).toEqual([]);
    expect(last.changes.inserted.map((column) => column.letter)).toEqual(['BP']);
    const first = inserted({ kind: 'input', afterFieldId: after('A'), input: input() });
    expect(first.changes.inserted.map((column) => column.letter)).toEqual(['B']);
    expect(first.changes.moved).toHaveLength(FIELD_COUNT - 1);
  });

  it('finds the product cells by their role after any insert, so BL, BN and BO are still the total, the price per tool cost and the approved price', () => {
    const result = inserted({ kind: 'input', afterFieldId: after('A'), input: input() });
    expect(fieldLetter(defined(findSystemField(result.document, 'total')))).toBe(indexToColumnLetter(seedFieldAt('BL').position + 1));
    expect(fieldLetter(defined(findSystemField(result.document, 'approved-price')))).toBe(indexToColumnLetter(seedFieldAt('BO').position + 1));
  });
});

describe('AC-6 (BR-038): what a new field is made with', () => {
  it('makes an input mandatory, visible to the Engineer, in its section after the last field of the form, with no stage and no formula', () => {
    const result = inserted({ kind: 'input', afterFieldId: after('AX'), input: input({ defaultValue: '3.5', unit: ' mm ', hint: 'Count the notches', watchFieldId: after('S') }) });
    const field = defined(findFieldById(result.document, defined(result.inserted[0]).id));
    const highest = Math.max(...seedConfig.fields.map((candidate) => candidate.formOrder ?? 0));
    expect(field).toMatchObject({
      kind: 'input',
      dataType: 'number',
      mandatory: true,
      engineerVisible: true,
      rowScope: 'row',
      systemRole: null,
      stageId: null,
      group: null,
      sectionId: SECTION_TWO,
      formOrder: highest + 1,
      defaultValue: '3.50',
      unit: 'mm',
      hint: 'Count the notches',
      visibleWhen: { fieldId: after('S'), operator: 'not-in', values: [''] },
      key: 'notch-count',
    });
    expect(Object.keys(field)).not.toContain('letter');
  });

  it('makes an output hidden from every Engineer, in the chosen stage and sub-heading, in no stage total and in no other formula', () => {
    const result = inserted({ kind: 'output', afterFieldId: after('AX'), output: output() });
    const field = defined(findFieldById(result.document, defined(result.inserted[0]).id));
    expect(field).toMatchObject({ kind: 'output', engineerVisible: false, mandatory: false, formOrder: null, sectionId: null, stageId: STAGE_PROCESS.id, group: 'Cutting', formula: '1' });
    expect(result.document.stages.flatMap((stage) => stage.totalFieldIds)).not.toContain(field.id);
    for (const other of result.document.fields) {
      if (other.kind === 'output' && other.formula !== null) expect(other.formula).not.toContain(field.id);
    }
  });

  it('numbers the form order of two inserts one after the other without a clash', () => {
    const first = inserted({ kind: 'input', afterFieldId: after('AX'), input: input() });
    const second = inserted({ kind: 'input', afterFieldId: after('AX'), input: input() }, parseConfigDocument(first.document));
    const orders = second.document.fields.map((field) => field.formOrder).filter((order) => order !== null);
    expect(new Set(orders).size).toBe(orders.length);
    expect(second.changes.inserted[0]?.letter).toBe('AY');
  });

  it('makes the key from the label in kebab-case and keeps it unique by a numeric suffix, so a label that repeats an existing one is allowed', () => {
    expect(keyFor('Cutting Cost', new Set(['cutting-cost']))).toBe('cutting-cost-2');
    expect(keyFor('Cutting Cost', new Set(['cutting-cost', 'cutting-cost-2']))).toBe('cutting-cost-3');
    expect(keyFor('  Édge  /  Notch #2 ', new Set())).toBe('edge-notch-2');
    expect(keyFor('2nd Hole', new Set())).toBe('field-2nd-hole');
    expect(keyFor('!!!', new Set())).toBe('field');
    expect(keyFor('x'.repeat(200), new Set())).toHaveLength(50);
    const result = inserted({ kind: 'output', afterFieldId: after('AX'), output: output({ label: 'Cutting Cost' }) });
    expect(defined(findFieldById(result.document, defined(result.inserted[0]).id)).key).toBe('cutting-cost-2');
    expect(() => parseConfigDocument(result.document)).not.toThrow();
  });

  it('accepts a label of exactly 200 characters and a key that stays inside the schema', () => {
    const result = inserted({ kind: 'input', afterFieldId: after('AX'), input: input({ label: 'L'.repeat(200) }) });
    expect(() => parseConfigDocument(result.document)).not.toThrow();
  });
});

describe('AC-7 and decision D-1: what is refused, with whose words', () => {
  const refused = (spec: InsertSpec): ReadonlyArray<{ field: string; message: string }> => {
    const result = insert(spec);
    if (result.ok) throw new Error('The insert should have been refused.');
    return result.issues;
  };

  it('asks for a label when it is empty or only spaces', () => {
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ label: '' }) })).toContainEqual({ field: 'input.label', message: 'Enter a label.' });
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ label: '    ' }) })).toContainEqual({ field: 'input.label', message: 'Enter a label.' });
  });

  it('refuses a label of 201 characters, and one with a control character', () => {
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ label: 'L'.repeat(201) }) })[0]).toMatchObject({ field: 'input.label' });
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ label: 'Bad\u0007Label' }) })[0]).toMatchObject({ field: 'input.label' });
  });

  it('asks for a section when there is none, or one the registry does not have', () => {
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ sectionId: '' }) })).toContainEqual({ field: 'input.sectionId', message: 'Choose a section.' });
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ sectionId: '00000000-0000-4000-8000-0000000000aa' }) })).toContainEqual({ field: 'input.sectionId', message: 'Choose a section.' });
  });

  it('takes a section above 8, which the Engineer form draws since STORY-08.08 (the limit of decision D-2 is lifted, AC-4)', () => {
    const extended: ConfigDocument = { ...seedConfig, sections: [...seedConfig.sections, { id: '00000000-0000-4000-8000-0000000000aa', number: 9, name: 'Ninth', shortName: 'Ninth', displayMode: 'cards' }] };
    const result = insertFields({ document: extended, rates: RATES, spec: { kind: 'input', afterFieldId: after('AX'), input: input({ sectionId: '00000000-0000-4000-8000-0000000000aa' }) }, newId });
    expect(result.ok).toBe(true);
  });

  it('refuses an "insert after" that is no column of the registry, for the field and for the cost column', () => {
    expect(refused({ kind: 'input', afterFieldId: '00000000-0000-4000-8000-00000000ffff', input: input() })).toContainEqual({ field: 'afterFieldId', message: 'Choose the column to insert after.' });
    expect(refused({ kind: 'pair', afterFieldId: after('AX'), input: input(), cost: { ...output(), afterFieldId: 'nonsense', hideWhenInputIsZero: true } })).toContainEqual({ field: 'cost.afterFieldId', message: 'Choose the column to insert after.' });
  });

  it('refuses a default that is not a number with up to 2 decimals, for a Number input', () => {
    for (const bad of ['abc', '1.234', '-1', '1e3', '1,5']) expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ defaultValue: bad }) })[0], bad).toMatchObject({ field: 'input.defaultValue' });
    expect(inserted({ kind: 'input', afterFieldId: after('AX'), input: input({ defaultValue: '12' }) }).document.fields.some((field) => field.kind === 'input' && field.defaultValue === '12.00')).toBe(true);
  });

  it('refuses a width outside 1 to 255 and a number format the registry does not use', () => {
    for (const width of [0, 0.5, 256, Number.NaN]) expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ width }) }), String(width)).toContainEqual(expect.objectContaining({ field: 'input.width' }));
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ numFmt: '0.000000' }) })).toContainEqual(expect.objectContaining({ field: 'input.numFmt' }));
  });

  it('refuses a value type that is not Number, Text or a choice, a field to watch that is no input, and a stage or sub-heading that is none', () => {
    // @ts-expect-error a client may send anything; the server checks it again (the strict body schema is the first gate, this is the second).
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ dataType: 'flag' }) })).toContainEqual(expect.objectContaining({ field: 'input.dataType' }));
    expect(refused({ kind: 'input', afterFieldId: after('AX'), input: input({ watchFieldId: after('AY') }) })).toContainEqual(expect.objectContaining({ field: 'input.watchFieldId' }));
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ stageId: 'x' }) })).toContainEqual({ field: 'output.stageId', message: 'Choose a stage.' });
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ group: 'No such heading' }) })).toContainEqual(expect.objectContaining({ field: 'output.group' }));
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ hideWhenZeroFieldId: after('AY') }) })).toContainEqual(expect.objectContaining({ field: 'output.hideWhenZeroFieldId' }));
  });

  it('asks for a formula when it is empty, and gives the SCR-18 words for an unknown name and a syntax error', () => {
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ formula: '  ' }) })).toContainEqual({ field: 'output.formula', message: 'Enter a formula.' });
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ formula: 'Invented-Rate-per-Unit * 2' }) })).toEqual([
      { field: 'output.formula', message: '"Invented-Rate-per-Unit" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.' },
    ]);
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ formula: 'AL +' }) })[0]?.message).toMatch(/^The formula ends too soon\./);
  });

  it('refuses a formula of more than 2,000 characters once stored', () => {
    const long = Array.from({ length: 700 }, () => 'AL').join(' + ');
    expect(refused({ kind: 'output', afterFieldId: after('AX'), output: output({ formula: long }) })).toEqual([{ field: 'output.formula', message: expect.stringMatching(/too long/) }]);
  });

  it('refuses a single output whose formula names its own new letter: it is a loop', () => {
    const [issue] = refused({ kind: 'output', afterFieldId: after('AX'), output: output({ formula: 'AY + 1' }) });
    expect(issue).toEqual({ field: 'output.formula', message: expect.stringContaining('depend on itself') });
  });

  it('accepts a pair whose cost formula names the new input (D-1), but refuses a cost formula that names the cost column itself', () => {
    const pair = (formula: string): InsertSpec => ({ kind: 'pair', afterFieldId: after('AX'), input: input(), cost: { ...output({ formula }), afterFieldId: null, hideWhenInputIsZero: false } });
    expect(insert(pair('AY * Cutting-Rate-per-Sec')).ok).toBe(true);
    expect(refused(pair('AZ + 1'))[0]).toMatchObject({ field: 'cost.formula', message: expect.stringContaining('depend on itself') });
  });

  it('reads a letter that exists only before the insert as the column now at that place (D-1)', () => {
    // After AL the new column is AM, so "AN" now means the former AM (Bending Cost).
    const result = inserted({ kind: 'output', afterFieldId: after('AL'), output: output({ formula: 'AN' }) });
    expect(defined(findFieldById(result.document, defined(result.inserted[0]).id))).toMatchObject({ formula: `{{f:${seedFieldAt('AM').id}}}` });
  });

  it('reports every problem at once, each under its own control', () => {
    const issues = refused({ kind: 'pair', afterFieldId: after('AX'), input: input({ label: '', sectionId: '' }), cost: { ...output({ label: ' ', formula: '' }), afterFieldId: null, hideWhenInputIsZero: true } });
    expect(issues.map((issue) => issue.field).sort()).toEqual(['cost.formula', 'cost.label', 'input.label', 'input.sectionId']);
  });

  it('never mutates the document it was given', () => {
    const copy = structuredClone(seedConfig);
    inserted({ kind: 'pair', afterFieldId: after('AX'), input: input(), cost: { ...output({ formula: 'AY' }), afterFieldId: null, hideWhenInputIsZero: true } });
    expect(seedConfig).toEqual(copy);
  });
});

describe('review SQR-01: "hide the line when 0" only for an input that holds a number', () => {
  const refused = (spec: InsertSpec): ReadonlyArray<{ field: string; message: string }> => {
    const result = insert(spec);
    if (result.ok) throw new Error('The insert should have been refused.');
    return result.issues;
  };
  const single = (hideWhenZeroFieldId: string): InsertSpec => ({ kind: 'output', afterFieldId: after('AX'), output: output({ hideWhenZeroFieldId }) });
  const pairOf = (dataType: 'number' | 'text', hide: boolean): InsertSpec => ({
    kind: 'pair',
    afterFieldId: after('AX'),
    input: input({ dataType, numFmt: dataType === 'text' ? '@' : '0.00' }),
    cost: { ...output({ formula: dataType === 'text' ? '1' : 'AY * 2' }), afterFieldId: null, hideWhenInputIsZero: hide },
  });

  it.each([
    ['a text input (Part No., B)', 'B'],
    ['a choice input (Material in Drawing, E)', 'E'],
    ['a Treatment / Color input (G)', 'G'],
    ['a picture (Part Model, C)', 'C'],
    ['an output (Total Process Cost, AY)', 'AY'],
  ])('refuses a single output that names %s, under output.hideWhenZeroFieldId (the cost view would read it as 0 and hide the line for good)', (_what, letter) => {
    expect(refused(single(after(letter)))).toContainEqual({ field: 'output.hideWhenZeroFieldId', message: 'Choose an input that holds a number.' });
  });

  it.each([
    ['a Number input (J)', 'J'],
    ['a flag (Hot Dip Galvanizing, Z)', 'Z'],
  ])('accepts a single output that names %s', (_what, letter) => {
    expect(inserted(single(after(letter))).document.fields.some((field) => field.kind === 'output' && field.hideWhenZero === after(letter))).toBe(true);
  });

  it('refuses a pair with a Text input and the hide flag on, under cost.hideWhenInputIsZero (it is on by default)', () => {
    expect(refused(pairOf('text', true))).toEqual([{ field: 'cost.hideWhenInputIsZero', message: 'Hide the line only for a Number input.' }]);
  });

  it('accepts a pair with a Text input and the hide flag off, and stores no hiding input; and a Number pair that hides on the new input', () => {
    const text = inserted(pairOf('text', false));
    expect(text.document.fields.find((field) => field.kind === 'output' && field.label === 'Notch Cost')).toMatchObject({ hideWhenZero: null });
    const number = inserted(pairOf('number', true));
    const newInput = defined(number.inserted.find((field) => field.kind === 'input'));
    expect(number.document.fields.find((field) => field.kind === 'output' && field.label === 'Notch Cost')).toMatchObject({ hideWhenZero: newInput.id });
  });
});
