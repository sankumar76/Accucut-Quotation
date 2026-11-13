import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fieldLetter, findFieldById, findSystemField, referenceContext } from '@/lib/fields/registry';
import { toDisplayForm } from '@/lib/formula';

import { defined } from '../../support/defined';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

import { QUANTITY_CASES } from './quantity-cases';

/**
 * STORY-03.04 AC-5 (test strategy section 5.4, "Holding the rule in place"): structure tests that fail when the quantity rule is changed
 * in the seed registry, so the rule cannot drift without a test saying so. They read the seed configuration only.
 *
 * Deviation, on purpose: the test strategy places these under `tests/architecture/`, but CI stage 11 runs `tests/unit`, `tests/integration`,
 * `tests/security` and `tests/acceptance` and no other directory, so a test there would never run. They live beside the CE cases instead.
 * The `no-rolled-up-figure` part that reads the response schemas of `/costs`, `/nodes/{id}/costs` and `/export-summary` belongs to the
 * stories that create those routes (06.02 and EPIC-07); the part that can be checked now, in the registry, is checked here.
 */

const referencesField = (formula: string | null, fieldId: string): boolean => formula !== null && formula.includes(`{{f:${fieldId}}}`);

describe('quantity-in-one-formula (SPEC section 7.4, ARCH-R6)', () => {
  it('H, found by its system role, is an operand of Sub Total 1 (BB) and of no other seed formula', () => {
    const quantity = defined(findSystemField(seedConfig, 'quantity'), 'the quantity field');
    const readers = seedConfig.fields.filter((field) => field.kind === 'output' && referencesField(field.formula, quantity.id));
    expect(readers.map((field) => field.key)).toEqual([seedFieldAt('BB').key]);
  });
});

describe('bl-is-sum-bg (FR-029)', () => {
  const unitPrice = defined(findSystemField(seedConfig, 'unit-price'), 'the unit price field');
  const total = defined(findSystemField(seedConfig, 'total'), 'the total field');

  it('BL is SUM over the field with the unit-price system role, and nothing else', () => {
    expect(total.kind === 'output' ? total.formula : null).toBe(`SUM({{f:${unitPrice.id}}})`);
    expect(total.rowScope).toBe('product');
  });

  it('is shown with the letter that field has now, so it follows a re-lettering', () => {
    const context = referenceContext(seedConfig, SEED_PROCESS_ITEMS);
    const formula = total.kind === 'output' ? defined(total.formula, 'the BL formula') : '';
    expect(toDisplayForm(formula, context)).toBe(`SUM(${fieldLetter(unitPrice)})`);
  });

  it('the unit price is itself the sum BB + BC + BD + BE + BF of one row, so BL adds each row once', () => {
    const formula = unitPrice.kind === 'output' ? defined(unitPrice.formula, 'the BG formula') : '';
    const operands = ['BB', 'BC', 'BD', 'BE', 'BF'].map((letter) => `{{f:${seedFieldAt(letter).id}}}`);
    expect(formula).toBe(operands.join(' + '));
  });
});

describe('no-rolled-up-figure (FR-030): no sum over rows except BL, BN and the total Tool Cost', () => {
  it('only BL and BN use SUM, both are product-level, and BN sums only the Tool Cost column', () => {
    const summing = seedConfig.fields.filter((field) => field.kind === 'output' && field.formula !== null && field.formula.includes('SUM('));
    expect(summing.map((field) => field.key).sort()).toEqual([seedFieldAt('BL').key, seedFieldAt('BN').key].sort());
    for (const field of summing) expect(field.rowScope, field.key).toBe('product');
    const toolCost = defined(findSystemField(seedConfig, 'tool-cost'), 'the tool cost field');
    const bn = defined(findFieldById(seedConfig, seedFieldAt('BN').id));
    expect(bn.kind === 'output' ? bn.formula : null).toBe(`{{f:${seedFieldAt('BL').id}}} / SUM({{f:${toolCost.id}}})`);
  });

  it('BO has no formula: the approved price is entered at approval, never calculated', () => {
    const bo = seedFieldAt('BO');
    expect(bo.kind === 'output' ? bo.formula : 'not an output').toBeNull();
  });
});

describe('quantity-cases-complete (test strategy section 5.6, G3 condition 14)', () => {
  const NUMBER = /^\d+(\.\d+)?$/;

  it('every CE case has a numeric expected BL and numeric stated figures, and the cases named in the story are all there', () => {
    for (const quantityCase of QUANTITY_CASES) {
      expect(quantityCase.bl, quantityCase.id).toMatch(NUMBER);
      for (const row of quantityCase.rows) {
        for (const text of [row.h, row.cost, row.bg]) expect(text, `${quantityCase.id} ${row.sl}`).toMatch(NUMBER);
      }
    }
    const ids = QUANTITY_CASES.map((quantityCase) => quantityCase.id.split(' ')[0]);
    for (const wanted of ['CE-1', 'CE-2', 'CE-3', 'CE-4', 'CE-5', 'CE-6', 'CE-7', 'CE-9', 'CE-10', 'CE-12']) expect(ids, wanted).toContain(wanted);
    expect(QUANTITY_CASES.filter((quantityCase) => quantityCase.id.startsWith('CE-9')).map((quantityCase) => quantityCase.bl)).toEqual(['24', '30', '24', '4', '2', '0', '0']);
    expect(QUANTITY_CASES.filter((quantityCase) => quantityCase.id.startsWith('CE-12')).map((quantityCase) => quantityCase.bl)).toEqual(['15', '5', '17', '1000']);
  });

  it('no quantity test is skipped, pending, todo or exclusive', () => {
    const roots = ['tests/unit/quantity/', 'tests/integration/calc/'].map((path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url)));
    const files = roots.flatMap((root) => readdirSync(root).filter((name) => name.endsWith('.ts')).map((name) => `${root}${name}`));
    expect(files.length).toBeGreaterThan(2);
    const marked = /\b(?:it|test|describe)\.(?:skip|todo|only|fails|skipIf|runIf)\b|\b(?:xit|xdescribe|fit|fdescribe)\(/;
    for (const file of files.filter((path) => !path.endsWith('holding-the-rule.test.ts'))) {
      expect(marked.test(readFileSync(file, 'utf8')), file).toBe(false);
    }
  });
});
