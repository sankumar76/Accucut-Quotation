import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { engineerGhostFrom } from '@/app/(portal)/estimates/[code]/engineer-ghost';
import { FORM_LOADING, FORM_LOCKED } from '@/components/features/estimate-workspace/estimate-texts';
import { PartForm } from '@/components/features/estimate-workspace/part-form';
import { ghostOf, PartFormGhost } from '@/components/features/estimate-workspace/part-form-ghost';
import * as layout from '@/components/shared/form-layout';
import type { FormField, FormView } from '@/lib/estimates/form-client';

import { defined } from '../support/defined';


/**
 * DEF-145 (AQP-502): the part form's loading ghost, `rulings/partform-placeholder-shape-2026-11-28.md`. These tests are the ruling's PF-n rules that a unit can hold; the heights and the movement of `#review-actions`
 * are measured in the browser by `tests/e2e/partform-placeholder.spec.ts` (PF-14 to PF-14g).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');
/** The code of a file without its comments, so a rule that is explained in a comment is not counted as broken by the comment. */
const code = (relative: string): string => source(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const field = (id: string, rule: FormField['rule'], extra: Partial<FormField> = {}): FormField => ({
  id,
  letter: 'A',
  label: `Label of ${id}`,
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: null,
  required: false,
  editable: true,
  visibleWhen: null,
  rule,
  ...extra,
});

const FORM: FormView = {
  lastSavedAt: null,
  sections: [
    {
      id: 'details',
      number: 1,
      name: 'Part Details',
      shortName: 'Details',
      columnRange: 'A–D',
      fields: [field('a', { type: 'text', maxLength: 80, multiline: false } as FormField['rule'], { hint: 'A hint that is real words' }), field('b', { type: 'text', maxLength: 400, multiline: true } as FormField['rule'])],
    },
    {
      id: 'material',
      number: 2,
      name: 'Material and Dimensions',
      shortName: 'Material',
      columnRange: 'E–K',
      fields: [
        field('fasteners', { type: 'choice', options: ['None', 'Yes'] }, { defaultValue: 'None' }),
        field('fasteners-qty', { type: 'text', maxLength: 10, multiline: false } as FormField['rule'], { visibleWhen: { fieldId: 'fasteners', values: ['None'] } as FormField['visibleWhen'] }),
        field('flag-1', { type: 'flag' }),
        field('flag-2', { type: 'flag' }),
        field('picture', { type: 'picture' }),
      ],
    },
  ],
};

const drawn = (props: Partial<Parameters<typeof PartFormGhost>[0]> = {}): string => renderToStaticMarkup(createElement(PartFormGhost, { form: FORM, head: 'lead', ...props }));

describe('PartFormGhost (DEF-145)', () => {
  it('PF-1, PF-2, PF-5: draws one card for every section, the strip with one item for each, and each field the form shows for the values given', () => {
    const html = drawn();
    expect(html.match(/style="--n:/g)).toHaveLength(2); // one card for each section, each with its weight
    expect(html).toContain('Part Details');
    expect(html).toContain('Material and Dimensions');
    expect(html).toContain('A–D');
    // PF-5.2: Fasteners Qty is hidden while Fasteners is "None" (its default), shown once the part has "Yes".
    expect(html.match(/h-\(--control-h\)/g)?.length).toBeGreaterThan(0);
    const hidden = drawn();
    const shown = drawn({ texts: { fasteners: 'Yes' } });
    const labels = (html: string): number => (html.match(/h-s-5 w-1\/2/g) ?? []).length;
    expect(labels(shown)).toBe(labels(hidden) + 1);
  });

  it('PF-5.3: the surface treatments are one field however many flags the section has', () => {
    const html = drawn();
    expect(html.match(/data-ghost-wide=""/g)?.length).toBe(2); // the multi-line box and the treatments
    expect(html.match(/data-ghost-picture=""/g)).toHaveLength(1);
  });

  it('PF-3: real words where they are known (the notice, the strip, the card names, the hints), grey blocks for data and controls; no value, no label text of a field', () => {
    const html = drawn({ notice: 'Read-only while approved.', head: 'engineer' });
    expect(html).toContain('Read-only while approved.');
    expect(html).toContain('A hint that is real words');
    expect(html).not.toContain('Label of a');
    expect(html).toContain('skeleton-shimmer');
  });

  it('PF-2: the Lead ghost draws a field as the review look shows it (no hint but the quantity one), so its height is the form height; the Engineer ghost keeps the hints', () => {
    expect(drawn({ head: 'lead' })).not.toContain('A hint that is real words');
    expect(drawn({ head: 'engineer' })).toContain('A hint that is real words');
  });

  it('PF-9.1: one busy status region with one hidden line, and the drawn blocks inert and hidden from assistive technology', () => {
    const html = drawn();
    expect(html.match(/role="status"/g)).toHaveLength(1);
    // No `aria-busy`: the review's figure tiles are invisible while one is on the page (`figure-tiles.tsx`, group-has-[[aria-busy=true]]), which blanked the Totals under the ghost (QLT-833-05).
    expect(html).not.toContain('aria-busy');
    expect(html).toContain(`<span class="sr-only">${FORM_LOADING}</span>`);
    expect(html).toMatch(/<div inert="" aria-hidden="true"/);
  });

  it('PF-9.2 (ux ruling, QLT-833-02): every ghost is a status named "Loading the form"; the first holds the one hidden line, a second one (the fields\' own wait) holds no words of its own', () => {
    const first = drawn();
    expect(first).toContain(`aria-label="${FORM_LOADING}"`);
    expect(first).toContain(`<span class="sr-only">${FORM_LOADING}</span>`);
    const second = drawn({ silent: true });
    expect(second).toContain('role="status"');
    expect(second).not.toContain('aria-busy');
    expect(second).toContain(`aria-label="${FORM_LOADING}"`);
    expect(second).not.toContain('sr-only">' + FORM_LOADING);
  });

  it('PF-9.4: no id, name, for, href, tabindex, heading, form or landmark, and none of the form\'s own markers a test waits for', () => {
    const html = drawn({ notice: 'x' });
    // The shared FIELDS string names `data-picture-zone` and `data-treatments` in its selectors, so the markers are looked for as attributes (`name=`), not as words.
    for (const forbidden of [' id=', ' name=', ' for=', ' href=', 'tabindex', '<h1', '<h2', '<h3', '<h4', '<form', '<nav', '<label', '<input', '<select', '<textarea', ' data-part-form=', ' data-part-grid=', ' data-section-strip=', ' data-part-eyebrow=', ' data-picture-zone=', ' data-treatments=', 'data-slot="textarea"', 'data-slot="input"', 'role="region"']) {
      expect(html, forbidden).not.toContain(forbidden);
    }
    // PF-9.4 (QLT-833-08): no `data-slot` of the form's own components; the one real notice the ghost may hold is the shared `Notice`, whose parts are named for the alert.
    expect([...html.matchAll(/ data-slot="([^"]+)"/g)].map((slot) => slot[1]).filter((slot) => !(slot ?? '').startsWith('alert'))).toEqual([]);
    for (const marker of ['data-part-ghost', 'data-ghost-grid']) expect(html).toContain(marker);
  });

  it('PF-9.4: the Engineer\'s ghost has the head the Engineer\'s form draws itself; the Lead\'s has not (the page draws that on the server)', () => {
    const lead = drawn({ head: 'lead' });
    const engineer = drawn({ head: 'engineer' });
    expect(engineer.length).toBeGreaterThan(lead.length);
  });

  it('PF-4: draws with the form\'s own class strings from the shared module', () => {
    const html = drawn().replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&quot;', '"');
    for (const classes of [layout.CARD_SHARE, layout.FIELDS, layout.CARD_GRID, layout.STRIP_LIST, layout.FIELD_BOX, layout.FORM_ROOT, layout.CONTROL_HEIGHT, layout.TEXTAREA_HEIGHT, layout.PICTURE_ZONE_HEIGHT_UNHINTED]) {
      expect(html, classes).toContain(classes);
    }
  });

  it('QLT-833-13: a picture field with no hint (the review look) has no hint line and the unhinted box; with a hint, the hint and the usual box', () => {
    const withHint: FormView = { ...FORM, sections: FORM.sections.map((section) => ({ ...section, fields: section.fields.map((entry) => (entry.rule.type === 'picture' ? { ...entry, hint: 'PNG or JPG, up to 200 KB.' } : entry)) })) };
    const hinted = renderToStaticMarkup(createElement(PartFormGhost, { form: withHint, head: 'engineer' })).replaceAll('&amp;', '&');
    expect(hinted).toContain(layout.PICTURE_ZONE_HEIGHT);
    expect(hinted).toContain('PNG or JPG, up to 200 KB.');
    const plain = drawn({ head: 'lead' }).replaceAll('&amp;', '&');
    expect(plain).toContain(layout.PICTURE_ZONE_HEIGHT_UNHINTED);
    expect(plain).not.toContain(layout.PICTURE_ZONE_HEIGHT);
  });

  it('PF-17: a page that cannot change the part draws the picture box as the thumbnail alone, whatever the hint; one that can draws the prompt and the button\'s box', () => {
    const withHint: FormView = { ...FORM, sections: FORM.sections.map((section) => ({ ...section, fields: section.fields.map((entry) => (entry.rule.type === 'picture' ? { ...entry, hint: 'PNG or JPG, up to 200 KB.' } : entry)) })) };
    for (const form of [FORM, withHint]) {
      const locked = renderToStaticMarkup(createElement(PartFormGhost, { form, head: 'lead', editable: false })).replaceAll('&amp;', '&');
      expect(locked).toContain(layout.PICTURE_ZONE_HEIGHT_READONLY);
      expect(locked).not.toContain(layout.PICTURE_ZONE_HEIGHT_UNHINTED);
      expect(locked).not.toContain(layout.PICTURE_ZONE_HEIGHT);
    }
    expect(layout.PICTURE_ZONE_HEIGHT_READONLY).toBe('h-[calc(var(--s-7)+2*var(--s-3)+2px)]');
  });

  it('the count block: the Engineer ghost says 0 of the total, the Lead ghost the count of the part (invisible words, no id)', () => {
    const counted: FormView = { ...FORM, sections: FORM.sections.map((section) => ({ ...section, fields: section.fields.map((entry) => ({ ...entry, required: true })) })) };
    const engineer = renderToStaticMarkup(createElement(PartFormGhost, { form: counted, head: 'engineer' }));
    expect(engineer).toContain('<span class="invisible">0 of ');
    expect(renderToStaticMarkup(createElement(PartFormGhost, { form: counted, head: 'lead', texts: { a: 'x' } }))).toContain('<span class="invisible">1 of ');
    expect(engineer).not.toMatch(/ id=/);
  });

  it('ghostOf: draws from the form\'s own readers, and nothing for a body the form would refuse (the bars stand in)', () => {
    expect(ghostOf({ form: { sections: 'x', lastSavedAt: null }, head: 'engineer', editable: true })).toBeUndefined();
    expect(ghostOf({ form: FORM, head: 'engineer', editable: true })).toBeDefined();
  });
});

describe('the ghost\'s place in the code (PF-4, PF-6)', () => {
  it('PF-4: the form\'s cards, strip and fields take their class strings from the shared module, as the ghost does, and keep no copy', () => {
    expect(code('src/components/features/estimate-workspace/section-card.tsx')).toContain("from '@/components/shared/form-layout'");
    expect(code('src/components/features/estimate-workspace/section-strip.tsx')).toContain("from '@/components/shared/form-layout'");
    expect(code('src/components/shared/form-field.tsx')).toContain("from './form-layout'");
    expect(code('src/components/features/estimate-workspace/part-form-ghost.tsx')).toContain("from '@/components/shared/form-layout'");
    expect(code('src/components/features/estimate-workspace/section-card.tsx')).not.toContain('flex-[var(--n)_1_calc');
    expect(code('src/components/features/estimate-workspace/section-card.tsx')).not.toContain('grid-cols-[repeat(auto-fill');
    expect(code('src/components/shared/form-field.tsx')).not.toContain("'flex min-w-0 flex-col gap-s-2'");
  });

  it('PF-4: the control height strings are the ones Input, NativeSelect and Textarea use', () => {
    // The classes sit among others in those components, so each class of the constant must be among theirs.
    for (const file of ['input.tsx', 'native-select.tsx']) for (const token of layout.CONTROL_HEIGHT.split(' ')) expect(source(`src/components/ui/${file}`), token).toContain(token);
    for (const token of layout.TEXTAREA_HEIGHT.split(' ')) expect(source('src/components/ui/textarea.tsx'), token).toContain(token);
  });

  it('PF-6: the ghost has no hook, no `use client` and no client component, and the form\'s shell imports it nowhere', () => {
    const ghost = code('src/components/features/estimate-workspace/part-form-ghost.tsx');
    expect(source('src/components/features/estimate-workspace/part-form-ghost.tsx')).not.toMatch(/^['"]use client['"]/m);
    expect(ghost).not.toMatch(/\buse[A-Z]\w*\(/);
    for (const clientCode of ['@/components/ui/label', '@/components/ui/progress', '@/components/ui/popover', 'radix-ui']) expect(ghost).not.toContain(clientCode);
    for (const shell of ['part-form.tsx', 'lazy-review-form.tsx', 'estimate-workspace.tsx']) {
      expect(code(`src/components/features/estimate-workspace/${shell}`), shell).not.toContain('part-form-ghost');
    }
    expect(code('src/components/shared/form-layout.ts')).not.toMatch(/\bimport\b/);
  });

  it('PF-6, DEF-085: the page hands the ghost down as an element, the Lead\'s from the seed it already built and the Engineer\'s from the bodies of its own seed, with no read of the form\'s definition of its own (DL-471)', () => {
    expect(code('src/components/features/estimate-review/estimate-review.tsx')).toContain('ghostOf(');
    const engineer = code('src/app/(portal)/estimates/[code]/engineer-ghost.tsx');
    expect(engineer).toContain('ghostOf(');
    // The builder takes the bodies the page already holds and reads nothing: no service and no `getForm`.
    expect(engineer).not.toContain('getForm');
    expect(engineer).not.toContain('@/server/');
    const page = code('src/app/(portal)/estimates/[code]/page.tsx');
    expect(page).toContain('engineerGhostFrom(');
    expect(page).not.toContain('getForm');
    expect(page).toContain('readFirstPartFormBodies(');
  });

  it('PF-6, DEF-085 (DL-469, which reverses DL-455 (3)(a)): the Engineer\'s form is seeded from the same read as its ghost', () => {
    const page = code('src/app/(portal)/estimates/[code]/page.tsx');
    expect(page).toContain('seed={seed}');
    expect(page).toContain('ghost={ghost}');
  });
});

describe('where the ghost stands in (PF-1, PF-7, PF-11)', () => {
  const GHOST = createElement('i', { 'data-test-ghost': '' });

  it('PF-7: while the Engineer\'s tree is unread the form area shows the ghost, and "Choose a part" only when the tree has been read and nothing is chosen', () => {
    const unread = renderToStaticMarkup(createElement(PartForm, { estimateId: 'e', part: null, editable: true, nodes: null, ghost: GHOST, treeUnread: true }));
    expect(unread).toContain('data-test-ghost');
    expect(unread).not.toContain('Choose a part');
    const read = renderToStaticMarkup(createElement(PartForm, { estimateId: 'e', part: null, editable: true, nodes: [], ghost: GHOST }));
    expect(read).not.toContain('data-test-ghost');
    expect(read).toContain('Choose a part');
  });

  it('PF-1: with a part chosen the form shows the ghost it was handed while the definition is read, and the three bars when it was handed none', () => {
    const part = { id: 'p', slNo: '1.1', revision: 0 };
    const withGhost = renderToStaticMarkup(createElement(PartForm, { estimateId: 'e', part, editable: true, nodes: null, ghost: GHOST }));
    expect(withGhost).toContain('data-test-ghost');
    const without = renderToStaticMarkup(createElement(PartForm, { estimateId: 'e', part, editable: true, nodes: null }));
    expect(without).toContain(FORM_LOADING);
    expect(without).not.toContain('data-test-ghost');
  });
});

describe('engineerGhostFrom (PF-6, PF-7, PF-15, DEF-085)', () => {
  const wire = { sections: FORM.sections.map((section) => ({ ...section, fields: section.fields.map((entry) => ({ ...entry, visibleWhen: entry.visibleWhen })) })), lastSavedAt: null };

  it('draws the ghost from the bodies it is given, with the locked notice when the Engineer cannot edit and none when they can', () => {
    const editable = renderToStaticMarkup(defined(engineerGhostFrom({ form: wire, part: undefined }, { status: 'DRAFT', ignored: false })));
    expect(editable).toContain('data-part-ghost');
    expect(editable).not.toContain(FORM_LOCKED);
    const locked = renderToStaticMarkup(defined(engineerGhostFrom({ form: wire, part: undefined }, { status: 'APPROVED', ignored: false })));
    expect(locked).toContain(FORM_LOCKED);
    const ignored = renderToStaticMarkup(defined(engineerGhostFrom({ form: wire, part: undefined }, { status: 'DRAFT', ignored: true })));
    expect(ignored).toContain(FORM_LOCKED);
  });

  it('draws no ghost (the three bars stand in) when the page holds no bodies (a read failed, or the estimate has no rows), and for a body the reader refuses', () => {
    expect(engineerGhostFrom(null, { status: 'DRAFT', ignored: false })).toBeUndefined();
    expect(engineerGhostFrom({ form: { sections: 'x', lastSavedAt: null }, part: undefined }, { status: 'DRAFT', ignored: false })).toBeUndefined();
  });

  it('PF-7: handed to the form with the tree unread, it is what the form area shows, and "Choose a part" is not', () => {
    const ghost = engineerGhostFrom({ form: wire, part: undefined }, { status: 'DRAFT', ignored: false });
    const unread = renderToStaticMarkup(createElement(PartForm, { estimateId: 'e', part: null, editable: true, nodes: null, ghost, treeUnread: true }));
    expect(unread).toContain('data-part-ghost');
    expect(unread).not.toContain('Choose a part');
  });
});
