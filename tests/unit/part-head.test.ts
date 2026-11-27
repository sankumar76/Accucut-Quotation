import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PartHead, partEyebrow } from '@/components/features/estimate-workspace/part-head';
import { SectionCard } from '@/components/features/estimate-workspace/section-card';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * AQP-454 (DEF-097 and DEF-098; SCR-05 mock-up): the form's head names the row and where it sits, and a section card has a number tile with the range tag and "n of m" on one line. Every name is invented.
 */

const row = (id: string, parentId: string | null, slNo: string, nodeKind: PartItem['nodeKind'], label = ''): PartItem => ({ id, parentId, slNo, label, nodeKind, completeness: 'EMPTY', revision: 1 });

const TREE: ReadonlyArray<PartItem> = [
  row('m', null, '1', 'MAIN_ASSEMBLY', 'Control cabinet assembly'),
  row('s', 'm', '1.1', 'SUB_ASSEMBLY', 'Base frame'),
  row('p', 's', '1.1.1', 'PART', ''),
  row('q', 's', '1.1.2', 'PART', 'Cross brace'),
  row('f', 'q', '1.1.2.1', 'FASTENER', ''),
];

describe('the eyebrow of the form (DEF-097)', () => {
  it('says the kind, the level and the row it is under, as the mock-up reads', () => {
    expect(partEyebrow(TREE, 's')).toBe('Sub-Assembly · level 2, under 1 Control cabinet assembly');
  });

  it('has no "under" for a Main Assembly, which is level 1', () => {
    expect(partEyebrow(TREE, 'm')).toBe('Main Assembly · level 1');
  });

  it('counts the levels down the tree, and names the row it is under by the one rule, the kind when it has no name', () => {
    expect(partEyebrow(TREE, 'f')).toBe('Fastener · level 4, under 1.1.2 Cross brace');
    expect(partEyebrow(TREE, 'p')).toBe('Sub-part · level 3, under 1.1 Base frame');
  });

  it('is empty for a row that is not in the tree', () => {
    expect(partEyebrow(TREE, 'gone')).toBe('');
  });
});

describe('the title of the form (DEF-097)', () => {
  const head = (partId: string, slNo: string): string => renderToStaticMarkup(createElement(PartHead, { partId, slNo, nodes: TREE, titleId: 'part-form-title', titleRef: null }));

  it('is the number and the name, "1.1 · Base frame"', () => {
    const html = head('s', '1.1');
    expect(html.replace(/<[^>]*>/g, '')).toContain('Base frame');
    expect(html.replace(/<[^>]*>/g, '')).toContain('1.1 · Base frame');
    expect(html).toContain('<span class="font-mono">1.1</span>');
  });

  it('is the kind\'s own name, muted, with the words for a screen reader, when the row has no name yet', () => {
    const html = head('p', '1.1.1');
    expect(html).toContain('italic');
    expect(html.replace(/<[^>]*>/g, '')).toContain('1.1.1 · Sub-part, no description yet');
  });

  it('keeps the heading id and takes the focus when asked (tabindex -1), as before', () => {
    const html = head('s', '1.1');
    expect(html).toContain('id="part-form-title"');
    expect(html).toContain('tabindex="-1"');
  });
});

describe('a section card (DEF-098)', () => {
  const card = (progress: { complete: number; total: number } | null, missing = false): string =>
    renderToStaticMarkup(SectionCard({ section: { id: 's1', number: 2, name: 'Material and Dimensions', columnRange: 'E, F, J–L, N' }, progress, missing, weight: 4, children: null }));

  it('has the number as a tile of its own, inside the heading, so the region is still named "02 Material and Dimensions"', () => {
    const html = card({ complete: 2, total: 5 });
    expect(html).toMatch(/<h3[^>]*>.*<span data-section-no="" class="[^"]*size-s-6[^"]*">02<\/span> <span class="min-w-0">Material and Dimensions<\/span><\/h3>/);
    expect(html.match(/<h3[^>]*>(.*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '')).toBe('02 Material and Dimensions');
  });

  it('puts the range tag and "2 of 5" in the one header, with "complete" for a screen reader only', () => {
    const html = card({ complete: 2, total: 5 });
    expect(html).toContain('data-section-count');
    expect(html.replace(/<[^>]*>/g, '')).toContain('2 of 5 complete');
    expect(html).toContain('<span class="sr-only"> complete</span>');
  });

  it('colours the tile: dark by default, green when every field has a value, red while a field is missing', () => {
    expect(card({ complete: 2, total: 5 })).toContain('bg-nav');
    expect(card({ complete: 5, total: 5 })).toContain('bg-success');
    expect(card({ complete: 2, total: 5 }, true)).toContain('bg-danger');
    expect(card(null)).not.toContain('data-section-count');
  });
});
