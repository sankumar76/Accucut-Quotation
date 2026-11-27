import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { FormField, FormRule, FormSection } from '@/lib/estimates/form-client';
import { MIN_SECTION_WEIGHT, sectionWeight } from '@/lib/estimates/form-values';

import { stripComments } from '../support/css-tokens';

/**
 * AQP-388 (CR-01 item 1; UX spec section 0.9 row 1): the input screen (SCR-05) and the two output screens (SCR-06, SCR-07) use a compact layout. A unit test cannot read a viewport, so the
 * measured numbers (padding, heights, columns, no overlap) are `tests/e2e/compact-layout.spec.ts`; what is judged here is what a measurement cannot: that the weight of a card is its number of
 * fields (AC-2), that the compact size of the shared controls is a variant of the `.is-compact` scope and the default is not changed (AC-7), and that the scope is set on these three screens and nowhere else.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8').replaceAll('\r\n', '\n');

const field = (id: string, rule: FormRule): FormField => ({ id, letter: id, label: id, kind: 'input', unit: null, hint: null, defaultValue: null, required: true, editable: true, visibleWhen: null, rule });
const NUMBER: FormRule = { type: 'number', decimals: 2 };
const numbers = (count: number): FormField[] => Array.from({ length: count }, (_, index) => field(`N${index}`, NUMBER));
const card = (fields: ReadonlyArray<FormField>): Pick<FormSection, 'fields'> => ({ fields });

describe('AC-2: the weight of a card follows its number of fields', () => {
  it('is the number of fields, so a card with more fields is heavier than one with fewer', () => {
    expect(sectionWeight(card(numbers(3)))).toBe(3);
    expect(sectionWeight(card(numbers(6)))).toBe(6);
    expect(sectionWeight(card(numbers(12)))).toBe(12);
    expect(sectionWeight(card(numbers(6)))).toBeGreaterThan(sectionWeight(card(numbers(4))));
  });

  it('is never below the least weight, so a card with one field (or none) is not squeezed narrower than two', () => {
    expect(MIN_SECTION_WEIGHT).toBe(2);
    expect(sectionWeight(card(numbers(1)))).toBe(MIN_SECTION_WEIGHT);
    expect(sectionWeight(card([]))).toBe(MIN_SECTION_WEIGHT);
  });

  it('counts the surface treatments once: the form draws the flags of a card as one multi-select', () => {
    const flags = Array.from({ length: 8 }, (_, index) => field(`F${index}`, { type: 'flag' }));
    expect(sectionWeight(card(flags))).toBe(MIN_SECTION_WEIGHT);
    expect(sectionWeight(card([...numbers(3), ...flags]))).toBe(4);
  });

  it('counts the picture as a field of its card (Part Model sits among the six of Part Details)', () => {
    expect(sectionWeight(card([...numbers(5), field('C', { type: 'picture' })]))).toBe(6);
  });
});

const GLOBALS = stripComments(read('src/app/globals.css'));

describe('AC-7: the compact sizing is a variant of the scope, and the defaults are not changed', () => {
  it('names the numbers once, as tokens: 140 px column minimum, 36 px field, 150 px per field of a card, 60 px textarea', () => {
    expect(GLOBALS).toMatch(/--compact-column-min:\s*140px/);
    expect(GLOBALS).toMatch(/--compact-field-h:\s*36px/);
    expect(GLOBALS).toMatch(/--compact-weight-unit:\s*150px/);
    expect(GLOBALS).toMatch(/--compact-textarea-min-h:\s*60px/);
  });

  it('defines `compact:` as the scope and `compact-fine:` as the scope from 1024 px with a fine pointer (a touch screen keeps 44 px at any width)', () => {
    expect(GLOBALS).toContain('@custom-variant compact (&:where(.is-compact *));');
    const fine = /@custom-variant compact-fine \{([\s\S]*?)\n\}/.exec(GLOBALS)?.[1] ?? '';
    expect(fine).toContain('@media (min-width: 1024px) and (pointer: fine)');
    expect(fine).toContain('&:where(.is-compact *)');
  });

  it('writes no rule of its own for the scope: the class is a marker and the two variants are the only way it acts', () => {
    expect(GLOBALS.match(/is-compact/g)?.length).toBe(2);
  });

  it('gives the shared boxes, lists and textarea their compact size through a variant and leaves the default size as it was', () => {
    for (const path of ['src/components/ui/input.tsx', 'src/components/ui/native-select.tsx', 'src/components/ui/select.tsx']) {
      const source = read(path);
      expect(source, path).toContain('h-(--control-h)');
      expect(source, path).toContain('compact-fine:h-(--compact-field-h)');
    }
    const textarea = read('src/components/ui/textarea.tsx');
    expect(textarea).toContain('min-h-(--textarea-min-h)');
    expect(textarea).toContain('compact:min-h-(--compact-textarea-min-h)');
    expect(GLOBALS).toMatch(/--control-h:\s*44px/);
    expect(GLOBALS).toMatch(/--textarea-min-h:\s*96px/);
  });

  it('sets no compact size on any other shared control (the buttons, the checkbox and the tabs keep 44 px)', () => {
    for (const name of ['button', 'checkbox', 'radio-group', 'switch', 'tabs', 'dropdown-menu']) expect(read(`src/components/ui/${name}.tsx`), name).not.toMatch(/compact/);
  });
});

/** The files under src that set the scope as a class of an element (a comment that names it does not count). */
function filesSettingTheScope(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return filesSettingTheScope(path);
    return /\.tsx$/.test(name) && /className="[^"]*\bis-compact\b/.test(readFileSync(path, 'utf8')) ? [relative(ROOT, path).replaceAll('\\', '/')] : [];
  });
}

describe('AC-7: the scope is set on SCR-05, SCR-06 and SCR-07 and on no other screen', () => {
  // The walk reads the whole source tree, which took longer than a test's own 5 s on a loaded machine (the same trap as tests/unit/tokens.test.ts, DEF-012): it runs in a hook (120 s limit).
  let named: string[] = [];
  beforeAll(() => {
    named = filesSettingTheScope(join(ROOT, 'src')).sort();
  });

  it('is set as a class by the part form (its root class string, shared with the loading ghost), the review (and its Change customer dialog, which is drawn outside the root of the review) and the cost details, and by nothing else under src', () => {
    expect(named).toEqual([
      'src/components/features/cost-details/cost-details.tsx',
      'src/components/features/estimate-customer/change-customer-dialog.tsx',
      'src/components/features/estimate-review/estimate-review.tsx',
    ]);
    // The form's root takes the scope from `FORM_ROOT` (shared with the ghost, which is laid out by the same compact sizes); it is a `.ts` string, so the walk above, which reads class attributes of `.tsx`, finds the one place by name.
    expect(read('src/components/shared/form-layout.ts')).toMatch(/FORM_ROOT = '[^']*\bis-compact\b/);
    expect(read('src/components/features/estimate-workspace/part-fields.tsx')).toContain('className={FORM_ROOT}');
  });
});
