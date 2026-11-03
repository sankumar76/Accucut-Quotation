import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { toDisplayForm, toInternalForm, extractReferences, MATERIAL_OPERAND_NAMES } from '@/lib/fields/formula-references';
import {
  describeVisibleWhen,
  fieldLetter,
  fieldsInFormOrder,
  findSystemField,
  referenceContext,
  sectionColumnRange,
} from '@/lib/fields/registry';
import { configDocumentSchema, parseConfigDocument } from '@/lib/fields/schema';
import { MATERIAL_OPERAND_KEYS } from '@/lib/fields/types';
import { engineerVisibleFields } from '@/lib/fields/visibility';

import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { defined } from '../../support/defined';

/**
 * The seed is checked against an independent copy of SPEC sections 7.1 and 7.4: the letters, labels, kinds
 * and formulas below are typed from the requirements file, not read back from the seed module.
 */

// ---- SPEC section 7.1 and 7.4, in column order: [letter, label, kind] ----------------------------------

const SPEC_FIELDS: ReadonlyArray<readonly [string, string, 'input' | 'auto' | 'output']> = [
  ['A', 'Sl. No', 'auto'],
  ['B', 'Part No.', 'input'],
  ['C', 'Part Model', 'input'],
  ['D', 'Description', 'input'],
  ['E', 'Material in Drawing', 'input'],
  ['F', 'Material Considered', 'auto'],
  ['G', 'Treatment / Color', 'input'],
  ['H', 'QTY per Assy', 'input'],
  ['I', 'Material Rate / Kg', 'auto'],
  ['J', 'Length', 'input'],
  ['K', 'Width', 'input'],
  ['L', 'Thickness', 'input'],
  ['M', 'Blank Weight', 'output'],
  ['N', 'Part Weight', 'input'],
  ['O', 'Scrap Weight', 'output'],
  ['P', 'Cutting Time', 'input'],
  ['Q', 'Cutting Length', 'input'],
  ['R', 'No. of Bend', 'input'],
  ['S', 'Fasteners', 'input'],
  ['T', 'Fasteners Qty', 'input'],
  ['U', 'Fasteners Cost', 'input'],
  ['V', 'Weld', 'input'],
  ['W', 'Drilling', 'input'],
  ['X', 'Tapping', 'input'],
  ['Y', 'CSK', 'input'],
  ['Z', 'Hot Dip Galvanizing', 'input'],
  ['AA', 'Primer', 'input'],
  ['AB', 'Shot Blasting', 'input'],
  ['AC', 'Polishing', 'input'],
  ['AD', 'Plating', 'input'],
  ['AE', 'Powder Coating', 'input'],
  ['AF', 'Foam', 'input'],
  ['AG', 'Soft Anodize', 'input'],
  ['AH', 'Area in Sq. in', 'output'],
  ['AI', 'Area in Sq. ft', 'output'],
  ['AJ', 'Remarks', 'input'],
  ['AK', 'Material Cost', 'output'],
  ['AL', 'Cutting Cost', 'output'],
  ['AM', 'Bending Cost', 'output'],
  ['AN', 'Drilling / Tapping Cost', 'output'],
  ['AO', 'Welding Cost', 'output'],
  ['AP', 'Machining Cost', 'input'],
  ['AQ', 'Hot Dip Galvanizing Cost', 'output'],
  ['AR', 'Primer Cost', 'output'],
  ['AS', 'Shot Blasting Cost', 'output'],
  ['AT', 'Polishing Cost', 'output'],
  ['AU', 'Plating Cost', 'input'],
  ['AV', 'Powder Coating Cost', 'output'],
  ['AW', 'Foam Cost', 'output'],
  ['AX', 'Soft Anodize Cost', 'output'],
  ['AY', 'Total Process Cost', 'output'],
  ['AZ', 'BO Cost / Fasteners', 'output'],
  ['BA', 'Material Cost + Total Process Cost + Others', 'output'],
  ['BB', 'Sub Total 1', 'output'],
  ['BC', 'Rejection', 'output'],
  ['BD', 'OH Profit', 'output'],
  ['BE', 'Inspection & Packing', 'output'],
  ['BF', 'Transportation', 'output'],
  ['BG', 'Unit Production Price (INR)', 'output'],
  ['BH', 'Exchange Rate USD', 'output'],
  ['BI', 'Exchange Rate EUR', 'output'],
  ['BJ', 'Unit Production Price (USD)', 'output'],
  ['BK', 'Unit Production Price (EUR)', 'output'],
  ['BL', 'Total Unit Production Price (INR)', 'output'],
  ['BM', 'Tool Cost', 'input'],
  ['BN', 'Total Unit Production Price (INR) / Tool Cost (INR)', 'output'],
  ['BO', 'Approved Quote Price', 'output'],
];

/** SPEC section 7.4 formulas as printed (display form). BO has none. Scrap Weight is the v1.5 text. */
const SPEC_FORMULAS: Readonly<Record<string, string>> = {
  M: '(L * K * J * Material-Specific-Gravity) / 1000000',
  O: 'IF(Material-Specific-Gravity > 0, M - N, 0)',
  AH: '(J * K * 2) / 645',
  AI: 'AH / 144',
  AK: '(M * I) - (O * Material-Scrap-Rate)',
  AL: 'P * Cutting-Rate-per-Sec',
  AM: 'R * Bending-Rate-per-stroke',
  AN: '(W + X + Y) * Drilling-Tapping-Rate',
  AO: 'N * Welding-rate-per-kg * V',
  AQ: '(N * Dip-Galvanizing-Cost-per-kg) * Z',
  AR: '(AI * Primer-rate-per-sqft) * AA',
  AS: '(N * Shot-Blasting-rate-per-kg) * AB',
  AT: 'AC * ((AH / 2) * Polishing-rate-per-sqin)',
  AV: 'AE * (AI * Powder-rate-per-sqft)',
  AW: 'AF * AI * Foam Cost',
  AX: 'AG * (AH * Soft-Anodize-rate-per-sqin)',
  AY: 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX',
  AZ: 'T * U',
  BA: 'AK + AY + AZ',
  BB: 'BA * H',
  BC: '0',
  BD: 'BB * OH Profit %',
  BE: 'BB * Inspection & Packing %',
  BF: 'BB * Transport %',
  BG: 'BB + BC + BD + BE + BF',
  BH: 'ExchangeRate-USD',
  BI: 'ExchangeRate-EUR',
  BJ: 'BG / BH',
  BK: 'BG / BI',
  BL: 'SUM(BG)',
  BN: 'BL / SUM(BM)',
};

const context = referenceContext(seedConfig, SEED_PROCESS_ITEMS);

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
  }
  return [];
}

describe('seed configuration: fields (AC-2)', () => {
  it('AC-2: passes its own schema', () => {
    expect(configDocumentSchema.safeParse(seedConfig).success).toBe(true);
  });

  it('AC-2: holds 67 fields, 35 inputs and auto fields and 32 outputs', () => {
    expect(seedConfig.fields).toHaveLength(67);
    expect(seedConfig.fields.filter((field) => field.kind !== 'output')).toHaveLength(35);
    expect(seedConfig.fields.filter((field) => field.kind === 'output')).toHaveLength(32);
    expect(SPEC_FIELDS).toHaveLength(67);
  });

  it.each(SPEC_FIELDS)('AC-2: column %s is %s (%s)', (letter, label, kind) => {
    const field = seedFieldAt(letter);
    expect(field.label).toBe(label);
    expect(field.kind).toBe(kind);
    // The letter is derived from position: position n is the nth letter of the SPEC table.
    expect(fieldLetter(field)).toBe(letter);
  });

  it('AC-2: positions run 1 to 67 with no gap, so the last field is BO', () => {
    expect(seedConfig.fields.map((field) => field.position)).toEqual(Array.from({ length: 67 }, (_, index) => index + 1));
    expect(fieldLetter(defined(seedConfig.fields[66]))).toBe('BO');
  });

  it('AC-2: has no letter property anywhere in the document (letters are derived)', () => {
    const keys = allKeys(seedConfig).map((key) => key.toLowerCase());
    expect(keys.filter((key) => key === 'letter' || key === 'letters' || key === 'column')).toEqual([]);
  });

  it('AC-2: every field has a unique id and key, and a width and number format', () => {
    expect(new Set(seedConfig.fields.map((field) => field.id)).size).toBe(67);
    expect(new Set(seedConfig.fields.map((field) => field.key)).size).toBe(67);
    for (const field of seedConfig.fields) {
      expect(field.width).toBeGreaterThan(0);
      expect(field.numFmt.length).toBeGreaterThan(0);
    }
  });

  it('AC-2: data types follow SPEC section 7.1', () => {
    const types = Object.fromEntries(seedConfig.fields.map((field) => [fieldLetter(field), field.dataType]));
    expect(types).toMatchObject({
      A: 'text', B: 'text', C: 'image', D: 'text', E: 'select', F: 'auto_lookup', G: 'select_other', H: 'number',
      I: 'auto_lookup', J: 'number', N: 'number', S: 'text', T: 'number', U: 'number', Z: 'flag', AG: 'flag',
      AP: 'number', AU: 'number', BM: 'number', AJ: 'text', BG: 'number',
    });
    for (const letter of ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG']) expect(types[letter]).toBe('flag');
  });
});

describe('seed configuration: system roles and visibility (AC-3)', () => {
  it('AC-3: systemRole is set on A, H, BG, BL, BM and BO and nowhere else', () => {
    const roles = Object.fromEntries(
      seedConfig.fields.filter((field) => field.systemRole !== null).map((field) => [fieldLetter(field), field.systemRole]),
    );
    expect(roles).toEqual({
      A: 'sl-no',
      H: 'quantity',
      BG: 'unit-price',
      BL: 'total',
      BM: 'tool-cost',
      BO: 'approved-price',
    });
  });

  it('AC-3: engineerVisible is true only for the inputs and for F', () => {
    const expected = SPEC_FIELDS.filter(([letter, , kind]) => kind === 'input' || letter === 'F').map(([letter]) => letter);
    const actual = engineerVisibleFields(seedConfig.fields).map(fieldLetter);
    expect(actual).toEqual(expected);
    for (const letter of ['A', 'I', 'BH', 'BI', 'BL', 'BO']) expect(seedFieldAt(letter).engineerVisible).toBe(false);
  });

  it('AC-3: Part Model (C) is optional and every other typed field except the flags is mandatory', () => {
    expect(seedFieldAt('C').mandatory).toBe(false);
    const mandatory = seedConfig.fields.filter((field) => field.kind === 'input' && field.dataType !== 'flag' && field.dataType !== 'image');
    expect(mandatory.length).toBeGreaterThan(20);
    for (const field of mandatory) expect(field.mandatory).toBe(true);
  });

  it('AC-3: Fasteners (S) defaults to None, and T and U show only while S is not None and not blank', () => {
    const fasteners = seedFieldAt('S');
    expect(fasteners.kind === 'input' && fasteners.defaultValue).toBe('None');
    for (const letter of ['T', 'U']) {
      const field = seedFieldAt(letter);
      expect(field.kind === 'input' && field.visibleWhen).toEqual({ fieldId: fasteners.id, operator: 'not-in', values: ['None', ''] });
      expect(describeVisibleWhen(seedConfig, field)).toBe("S not in ['None','']");
    }
  });

  it('AC-3: each treatment output hides itself while its flag is 0', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['AQ', 'Z'], ['AR', 'AA'], ['AS', 'AB'], ['AT', 'AC'], ['AV', 'AE'], ['AW', 'AF'], ['AX', 'AG'],
    ];
    for (const [output, flag] of pairs) {
      const field = seedFieldAt(output);
      expect(field.kind === 'output' && field.hideWhenZero).toBe(seedFieldAt(flag).id);
    }
    const hiding = seedConfig.fields.filter((field) => field.kind === 'output' && field.hideWhenZero !== null);
    expect(hiding).toHaveLength(7);
    // The Plating flag (AD) is used by no formula and hides nothing (D-40).
    expect(hiding.some((field) => field.kind === 'output' && field.hideWhenZero === seedFieldAt('AD').id)).toBe(false);
  });

  it('AC-3: section 08 is entered in the order AP, AU, BM, AJ and not in letter order', () => {
    const section = defined(seedConfig.sections.find((candidate) => candidate.number === 8));
    expect(fieldsInFormOrder(seedConfig, section).map(fieldLetter)).toEqual(['AP', 'AU', 'BM', 'AJ']);
  });

  it('AC-3: BL, BN and BO are product-level and every other field is per row', () => {
    const product = seedConfig.fields.filter((field) => field.rowScope === 'product').map(fieldLetter);
    expect(product).toEqual(['BL', 'BN', 'BO']);
  });

  it('AC-3: the Engineer form order is SPEC section 7.1 table order across all sections', () => {
    const ordered = seedConfig.fields
      .filter((field) => field.formOrder !== null)
      .sort((a, b) => (a.formOrder ?? 0) - (b.formOrder ?? 0))
      .map(fieldLetter);
    expect(ordered).toEqual([
      'A', 'B', 'C', 'D', 'G', 'H', 'E', 'F', 'I', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U',
      'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AP', 'AU', 'BM', 'AJ',
    ]);
  });

  it('AC-3: QTY per Assy carries the hint that it is the count for the whole order (D-34)', () => {
    expect(seedFieldAt('H').hint).toMatch(/whole order/i);
    expect(seedFieldAt('H').label).toBe('QTY per Assy');
  });
});

describe('seed configuration: sections and stages (AC-4)', () => {
  const SECTION_RANGES = ['A–D, G, H', 'E, F, I–L, N', 'P, Q', 'R', 'S–U', 'V–Y', 'Z–AG', 'AJ, AP, AU, BM'];

  it('AC-4: has eight sections, 01 Part Details to 08 Other Costs and Remarks, with short names', () => {
    expect(seedConfig.sections.map((section) => [section.number, section.name])).toEqual([
      [1, 'Part Details'],
      [2, 'Material and Dimensions'],
      [3, 'Cutting Process'],
      [4, 'Bending'],
      [5, 'Fasteners'],
      [6, 'Welding'],
      [7, 'Surface Treatment'],
      [8, 'Other Costs and Remarks'],
    ]);
    for (const section of seedConfig.sections) expect(section.shortName.length).toBeGreaterThan(0);
  });

  it('AC-4: only section 07 is a multi-select; the others are cards', () => {
    expect(seedConfig.sections.filter((section) => section.displayMode === 'multi-select').map((section) => section.number)).toEqual([7]);
  });

  it('AC-4: each section derives its column range from its fields', () => {
    expect(seedConfig.sections.map((section) => sectionColumnRange(seedConfig, section))).toEqual(SECTION_RANGES);
  });

  it('AC-4: the range tag follows the fields the viewer sees (an Engineer does not see I)', () => {
    const material = defined(seedConfig.sections[1]);
    expect(sectionColumnRange(seedConfig, material, (field) => field.engineerVisible)).toBe('E, F, J–L, N');
  });

  it('AC-4: every input and auto field is in a section and no output is', () => {
    for (const field of seedConfig.fields) {
      expect(field.sectionId === null).toBe(field.kind === 'output');
    }
  });

  it('AC-4: has six stages; stage 3 totals Total Process Cost and stage 5 adds BC to BF', () => {
    expect(seedConfig.stages).toHaveLength(6);
    expect(seedConfig.stages.map((stage) => stage.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const totals = seedConfig.stages.map((stage) =>
      stage.totalFieldIds.map((id) => fieldLetter(defined(seedConfig.fields.find((field) => field.id === id)))),
    );
    expect(totals[2]).toEqual(['AY']);
    expect(totals[4]).toEqual(['BC', 'BD', 'BE', 'BF']);
  });

  it('AC-4: stage 3 has the sub-headings of SPEC section 7.4 and every output sits in a stage', () => {
    expect(defined(seedConfig.stages[2]).subHeadings).toEqual([
      'Cutting', 'Bending', 'Welding', 'Surface Treatment', 'Entered directly', 'Process Total',
    ]);
    for (const field of seedConfig.fields.filter((candidate) => candidate.kind === 'output')) {
      expect(field.stageId).not.toBeNull();
    }
    const stageOf = (letter: string) => defined(seedConfig.stages.find((stage) => stage.id === seedFieldAt(letter).stageId)).number;
    expect(['M', 'O', 'AH', 'AI'].map(stageOf)).toEqual([1, 1, 1, 1]);
    expect(['AK', 'AL', 'AY', 'AZ', 'BB', 'BC', 'BF', 'BG', 'BK'].map(stageOf)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(['AP', 'AU'].map((letter) => seedFieldAt(letter).group)).toEqual(['Entered directly', 'Entered directly']);
  });
});

describe('seed configuration: formulas (AC-5)', () => {
  const withFormula = seedConfig.fields.filter((field) => field.kind === 'output');

  it('AC-5: all 31 SPEC section 7.4 formulas are present and BO has none', () => {
    expect(Object.keys(SPEC_FORMULAS)).toHaveLength(31);
    const withoutFormula = withFormula.filter((field) => field.kind === 'output' && field.formula === null).map(fieldLetter);
    expect(withoutFormula).toEqual(['BO']);
    for (const letter of Object.keys(SPEC_FORMULAS)) expect(withFormula.map(fieldLetter)).toContain(letter);
  });

  it.each(Object.entries(SPEC_FORMULAS))('AC-5: %s reads as the SPEC text when shown with letters', (letter, text) => {
    const field = seedFieldAt(letter);
    if (field.kind !== 'output' || field.formula === null) throw new Error(`${letter} has no formula`);
    expect(toDisplayForm(field.formula, context)).toBe(text);
    // And the other way: the SPEC text stores to exactly the stored form.
    expect(toInternalForm(text, context)).toBe(field.formula);
  });

  it('AC-5: stored formulas hold references only, never a letter, a rate name or a material name', () => {
    for (const field of withFormula) {
      if (field.kind !== 'output' || field.formula === null) continue;
      const withoutReferences = field.formula.replace(/\{\{[^{}]*\}\}/g, '');
      expect(withoutReferences).not.toMatch(/[A-Za-z]{1}[A-Za-z]/u.source === '' ? /$^/ : /(?<![A-Za-z])(?!IF|SUM)[A-Za-z]+/);
    }
  });

  it('AC-5: Scrap Weight is the guarded formula, Rejection is 0, BL is SUM(BG) and BN is BL / SUM(BM)', () => {
    const stored = (letter: string): string | null => {
      const field = seedFieldAt(letter);
      return field.kind === 'output' ? field.formula : null;
    };
    const idOf = (letter: string): string => seedFieldAt(letter).id;
    expect(stored('O')).toBe(`IF({{mat:specificGravity}} > 0, {{f:${idOf('M')}}} - {{f:${idOf('N')}}}, 0)`);
    expect(stored('BC')).toBe('0');
    expect(stored('BL')).toBe(`SUM({{f:${idOf('BG')}}})`);
    expect(stored('BN')).toBe(`{{f:${idOf('BL')}}} / SUM({{f:${idOf('BM')}}})`);
    expect(stored('BH')).toBe('{{fx:USD}}');
    expect(stored('BI')).toBe('{{fx:EUR}}');
  });

  it('AC-5: quantity-in-one-formula: H is an operand in BB and in no other seed formula', () => {
    const quantity = defined(findSystemField(seedConfig, 'quantity'));
    const users = withFormula.filter(
      (field) =>
        field.kind === 'output' &&
        field.formula !== null &&
        extractReferences(field.formula).some((reference) => reference.kind === 'field' && reference.id === quantity.id),
    );
    expect(users.map(fieldLetter)).toEqual(['BB']);
  });

  it('AC-5: bl-is-sum-bg: BL sums the field with the unit-price role', () => {
    const total = defined(findSystemField(seedConfig, 'total'));
    const unitPrice = defined(findSystemField(seedConfig, 'unit-price'));
    expect(total.kind === 'output' && total.formula).toBe(`SUM({{f:${unitPrice.id}}})`);
    expect(fieldLetter(unitPrice)).toBe('BG');
  });

  it('AC-5: every rate reference is one of the 15 fixed seed IDs, and Plating-rate-per-sqin is not used (D-40)', () => {
    const rateIds = new Set<string>();
    for (const field of withFormula) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const reference of extractReferences(field.formula)) if (reference.kind === 'rate') rateIds.add(reference.id);
    }
    const known = new Set(SEED_PROCESS_ITEMS.map((item) => item.id));
    expect(rateIds.size).toBe(14);
    for (const id of rateIds) expect(known.has(id)).toBe(true);
    const plating = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Plating-rate-per-sqin'));
    expect(rateIds.has(plating.id)).toBe(false);
  });

  it('AC-5: every material reference is one of the three operand keys, and AK reads the scrap rate (D-39)', () => {
    const keys = new Set<string>();
    for (const field of withFormula) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const reference of extractReferences(field.formula)) if (reference.kind === 'material') keys.add(reference.key);
    }
    for (const key of keys) expect(MATERIAL_OPERAND_KEYS).toContain(key);
    // Material-Price-per-kg is reached through the Material Rate field (I), so no seed formula names it.
    expect([...keys].sort()).toEqual(['scrapRate', 'specificGravity']);
    const material = seedFieldAt('AK');
    expect(material.kind === 'output' && material.formula).toContain('{{mat:scrapRate}}');
    expect(MATERIAL_OPERAND_NAMES.scrapRate).toBe('Material-Scrap-Rate');
  });

  it('AC-5: re-lettering follows position: inserting a field before BG shows every later letter one further on', () => {
    // The stored text never changes; only the context's order does (SPEC section 8.3, automatic re-lettering).
    const inserted = { ...context, fieldIds: [...context.fieldIds.slice(0, 58), '00000000-0000-4000-8000-00ff00000000', ...context.fieldIds.slice(58)] };
    const total = seedFieldAt('BL');
    if (total.kind !== 'output' || total.formula === null) throw new Error('BL has no formula');
    expect(toDisplayForm(total.formula, inserted)).toBe('SUM(BH)');
  });
});

describe('seed configuration: process items (AC-5, D-38)', () => {
  it('AC-5: seed-ids holds 15 distinct fixed IDs with their SPEC section 4.1 names and units', () => {
    expect(SEED_PROCESS_ITEMS).toHaveLength(15);
    expect(new Set(SEED_PROCESS_ITEMS.map((item) => item.id)).size).toBe(15);
    expect(new Set(SEED_PROCESS_ITEMS.map((item) => item.name)).size).toBe(15);
    expect(SEED_PROCESS_ITEMS.map((item) => [item.name, item.unit])).toEqual([
      ['Cutting-Rate-per-Sec', 'per second'],
      ['Bending-Rate-per-stroke', 'per stroke'],
      ['Drilling-Tapping-Rate', 'per hole'],
      ['Welding-rate-per-kg', 'per kg'],
      ['Dip-Galvanizing-Cost-per-kg', 'per kg'],
      ['Primer-rate-per-sqft', 'per sq ft'],
      ['Shot-Blasting-rate-per-kg', 'per kg'],
      ['Polishing-rate-per-sqin', 'per sq in'],
      ['Plating-rate-per-sqin', 'per sq in'],
      ['Powder-rate-per-sqft', 'per sq ft'],
      ['Foam Cost', 'per sq ft'],
      ['Soft-Anodize-rate-per-sqin', 'per sq in'],
      ['OH Profit %', '%'],
      ['Transport %', '%'],
      ['Inspection & Packing %', '%'],
    ]);
  });

  it('AC-5: the IDs are valid UUIDs, so a migration can insert them into a uuid column', () => {
    for (const item of SEED_PROCESS_ITEMS) expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('seed configuration: structure only (AC-7, ADR-014)', () => {
  it('AC-7: the only numbers in the document are positions, widths, form order and section and stage numbers', () => {
    const allowed = new Set(['position', 'width', 'formOrder', 'number']);
    const numbers: string[] = [];
    const walk = (value: unknown, key: string): void => {
      if (typeof value === 'number' && !allowed.has(key)) numbers.push(key);
      if (Array.isArray(value)) value.forEach((child) => walk(child, key));
      else if (typeof value === 'object' && value !== null) Object.entries(value).forEach(([name, child]) => walk(child, name));
    };
    walk(seedConfig, '');
    expect(numbers).toEqual([]);
  });

  it('AC-7: the only defaults are None for Fasteners and 0 for an unchosen treatment flag', () => {
    const defaults = seedConfig.fields.flatMap((field) =>
      field.kind === 'input' && field.defaultValue !== null ? [[fieldLetter(field), field.defaultValue]] : [],
    );
    expect(defaults).toEqual([
      ['S', 'None'],
      ['Z', '0'], ['AA', '0'], ['AB', '0'], ['AC', '0'], ['AD', '0'], ['AE', '0'], ['AF', '0'], ['AG', '0'],
    ]);
  });

  it('AC-7: the seed folder holds TypeScript modules only, so it needs no data-file allow-list entry', () => {
    const folder = fileURLToPath(new URL('../../../prisma/seed/config/', import.meta.url));
    const files = readdirSync(folder);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/\.ts$/);
  });

  it('QLT-07: the shared seed is deep-frozen, so nothing can change it by accident', () => {
    expect(Object.isFrozen(seedConfig)).toBe(true);
    expect(Object.isFrozen(seedConfig.fields)).toBe(true);
    expect(Object.isFrozen(defined(seedConfig.fields[0]))).toBe(true);
    expect(Object.isFrozen(defined(seedConfig.stages[2]).subHeadings)).toBe(true);
    expect(() => {
      defined(seedConfig.fields[0]).label = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      seedConfig.fields.push(defined(seedConfig.fields[0]));
    }).toThrow(TypeError);
  });

  it('AC-7: parsing the seed again gives an identical document (the module is deterministic)', () => {
    expect(parseConfigDocument(JSON.parse(JSON.stringify(seedConfig)))).toEqual(seedConfig);
  });
});
