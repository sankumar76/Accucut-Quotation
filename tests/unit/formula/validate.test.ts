import { describe, expect, it } from 'vitest';

import { ConfigDocumentError, parseConfigDocument } from '@/lib/fields/schema';
import {
  analyzeConfiguration,
  checkDisplayFormula,
  parseFormula,
  validateFormulas,
  type ReferenceContext,
  type ValidatableField,
} from '@/lib/formula';
import { fieldLetter, referenceContext } from '@/lib/fields/registry';

import { cloneSeedConfig, SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { defined } from '../../support/defined';
import { fieldAt, RATE_PLAIN } from '../../support/formula-fixtures';
import { thrownAs } from '../../support/thrown';

/**
 * AC-5: bad formulas are rejected with a clear message at save time, and the seed configuration of story 03.01
 * passes with 0 errors and 0 cycles. Two entry points: `checkDisplayFormula` (one formula as typed) and
 * `validateFormulas` (the stored formulas of a configuration).
 */

describe('the seed configuration (AC-5)', () => {
  it('AC-5: passes with 0 errors and 0 cycles', () => {
    const analysis = analyzeConfiguration(seedConfig.fields);
    expect(analysis.issues).toEqual([]);
    expect(analysis.issues.filter((issue) => issue.code === 'CYCLE')).toHaveLength(0);
    expect(analysis.order).not.toBeNull();
  });

  it('AC-5: reads every one of its 31 formulas', () => {
    expect(analyzeConfiguration(seedConfig.fields).parsed.size).toBe(31);
  });

  it('AC-5: passes when every rate it names is in the Process Master', () => {
    const rateIds = new Set(SEED_PROCESS_ITEMS.map((item) => item.id));
    expect(validateFormulas(seedConfig.fields, { rateIds })).toEqual([]);
  });

  it('AC-5: orders row-scope formulas before product-scope ones, with BL and BN last', () => {
    const order = analyzeConfiguration(seedConfig.fields).order;
    const letterOf = (id: string): string => fieldLetter(defined(seedConfig.fields.find((field) => field.id === id)));
    expect(order?.rowOrder).toHaveLength(29);
    expect(order?.productOrder.map((formula) => letterOf(formula.fieldId))).toEqual(['BL', 'BN']);
  });
});

describe('a configuration that is not valid (AC-5)', () => {
  it('AC-5: a test configuration with a cycle fails, and the message names the loop: AL → AY → AL', () => {
    const document = cloneSeedConfig();
    const cutting = seedFieldAt('AL', document);
    // Cutting Cost now reads Total Process Cost, which already adds Cutting Cost.
    if (cutting.kind !== 'output') throw new Error('AL is an output');
    cutting.formula = `{{f:${seedFieldAt('AY').id}}}`;
    const issues = validateFormulas(document.fields);
    const cycle = issues.find((issue) => issue.code === 'CYCLE');
    expect(cycle).toMatchObject({ message: 'These fields refer to each other in a loop: AL → AY → AL.', fieldId: seedFieldAt('AL').id });
    expect(analyzeConfiguration(document.fields).order).toBeNull();
  });

  it('AC-5: the document schema refuses it, at the field that starts the loop, without repeating a formula', () => {
    const document = cloneSeedConfig();
    const cutting = seedFieldAt('AL', document);
    if (cutting.kind !== 'output') throw new Error('AL is an output');
    cutting.formula = `{{f:${seedFieldAt('AY').id}}}`;
    const error = thrownAs(() => parseConfigDocument(document), ConfigDocumentError);
    expect(error.message).toContain('fields.37.formula: These fields refer to each other in a loop: AL → AY → AL.');
    expect(error.message).not.toContain('{{');
  });

  it('AC-5: the document schema refuses a formula with a syntax error, at its field, with the position', () => {
    const document = cloneSeedConfig();
    const cutting = seedFieldAt('AL', document);
    if (cutting.kind !== 'output') throw new Error('AL is an output');
    cutting.formula = `{{f:${seedFieldAt('P').id}}} * * 2`;
    const error = thrownAs(() => parseConfigDocument(document), ConfigDocumentError);
    expect(error.issues).toContainEqual({ path: 'fields.37.formula', message: 'An operand is expected (character 46).' });
  });

  it('AC-5: a reference to a field that does not exist is refused', () => {
    const document = cloneSeedConfig();
    const cutting = seedFieldAt('AL', document);
    if (cutting.kind !== 'output') throw new Error('AL is an output');
    cutting.formula = '{{f:00000000-0000-4000-8000-00dd00000000}} + 1';
    expect(validateFormulas(document.fields)).toContainEqual({
      code: 'BAD_FIELD_REFERENCE',
      message: 'A formula refers to a field that is not in the registry.',
      fieldId: seedFieldAt('AL').id,
    });
  });

  it('AC-5: SUM of a field that does not exist is refused too', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'product', kind: 'output', formula: 'SUM({{f:00000000-0000-4000-8000-00dd00000000}})' },
    ];
    expect(validateFormulas(fields).map((issue) => issue.code)).toContain('BAD_FIELD_REFERENCE');
  });

  it('AC-5: a rate that the Process Master does not have is refused when the caller knows the rates', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'row', kind: 'output', formula: `{{rate:${RATE_PLAIN}}}` },
    ];
    expect(validateFormulas(fields)).toEqual([]);
    expect(validateFormulas(fields, { rateIds: new Set(['00000000-0000-4000-8000-0bbb0000ffff']) }).map((issue) => issue.code)).toEqual([
      'UNKNOWN_RATE',
    ]);
  });

  it('AC-1: ROLLUP in a stored formula is refused as an unknown function', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'product', kind: 'output', formula: `ROLLUP({{f:${fieldAt('B')}}})` },
      { id: fieldAt('B'), position: 2, rowScope: 'row', kind: 'input' },
    ];
    expect(validateFormulas(fields)).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FUNCTION', fieldId: fieldAt('A'), position: 1 }),
    ]);
  });

  it('AC-1: a comparison outside IF in a stored formula is refused', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'row', kind: 'output', formula: '1 > 0' },
    ];
    expect(validateFormulas(fields)).toEqual([expect.objectContaining({ code: 'COMPARISON_OUTSIDE_IF', fieldId: fieldAt('A') })]);
  });

  it('reports every field that has a problem, not just the first', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'row', kind: 'output', formula: '1 +' },
      { id: fieldAt('B'), position: 2, rowScope: 'row', kind: 'output', formula: '* 2' },
      { id: fieldAt('C'), position: 3, rowScope: 'row', kind: 'output', formula: '3' },
    ];
    expect(validateFormulas(fields).map((issue) => [issue.fieldId, issue.code])).toEqual([
      [fieldAt('A'), 'UNEXPECTED_END'],
      [fieldAt('B'), 'EXPECTED_OPERAND'],
    ]);
  });

  it('ignores a field that is not an output and an output that has no formula', () => {
    const fields: ValidatableField[] = [
      { id: fieldAt('A'), position: 1, rowScope: 'row', kind: 'input' },
      { id: fieldAt('B'), position: 2, rowScope: 'row', kind: 'output', formula: null },
      { id: fieldAt('C'), position: 3, rowScope: 'row', kind: 'output' },
    ];
    expect(analyzeConfiguration(fields)).toMatchObject({ issues: [], order: { rowOrder: [], productOrder: [] } });
  });

  it('reads each stored formula once', () => {
    let parses = 0;
    const analysis = analyzeConfiguration(seedConfig.fields, {
      parse: (text) => {
        parses += 1;
        return parseFormula(text, { form: 'internal' });
      },
    });
    expect(analysis.issues).toEqual([]);
    expect(parses).toBe(31);
  });

  it('lets a non-formula error from a parser through rather than hiding it', () => {
    expect(() =>
      analyzeConfiguration([{ id: fieldAt('A'), position: 1, rowScope: 'row', kind: 'output', formula: '1' }], {
        parse: () => {
          throw new TypeError('not a formula error');
        },
      }),
    ).toThrow(TypeError);
  });
});

describe('checkDisplayFormula: one formula as typed (AC-5)', () => {
  const context = referenceContext(seedConfig, SEED_PROCESS_ITEMS);

  it('AC-5: accepts a valid formula and gives the text to store', () => {
    const check = checkDisplayFormula('P * Cutting-Rate-per-Sec + 1', context);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.internalForm).toMatch(/^\{\{f:[0-9a-f-]+\}\} \* \{\{rate:[0-9a-f-]+\}\} \+ 1$/);
    expect(check.expression.kind).toBe('binary');
  });

  it('AC-5: names an unknown rate, with its position, in the issue and not in the message', () => {
    const check = checkDisplayFormula('P * Cutting-Rate-per-Min', context);
    expect(check).toMatchObject({ ok: false, issue: { code: 'UNKNOWN_NAME', position: 5, name: 'Cutting' } });
    if (check.ok) return;
    expect(check.issue.message).not.toContain('Cutting');
  });

  it('AC-5: names an unknown column letter', () => {
    expect(checkDisplayFormula('P * ZZZ', context)).toMatchObject({ ok: false, issue: { code: 'UNKNOWN_COLUMN', name: 'ZZZ' } });
  });

  it('AC-5: names an unknown function', () => {
    expect(checkDisplayFormula('ROLLUP(BG)', context)).toMatchObject({ ok: false, issue: { code: 'UNKNOWN_FUNCTION', name: 'ROLLUP' } });
  });

  it('AC-5: a syntax error carries a character position', () => {
    expect(checkDisplayFormula('(P + 2', context)).toMatchObject({ ok: false, issue: { code: 'UNCLOSED_BRACKET', position: 1 } });
    expect(checkDisplayFormula('P + * 2', context)).toMatchObject({ ok: false, issue: { code: 'EXPECTED_OPERAND', position: 5 } });
  });

  it('rethrows anything that is not a formula problem', () => {
    const failing: ReferenceContext = {
      fieldIds: [],
      get rates(): never {
        throw new TypeError('not a formula error');
      },
    };
    expect(() => checkDisplayFormula('A', failing)).toThrow(TypeError);
  });
});
