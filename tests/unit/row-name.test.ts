import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TreeNode } from '@/components/features/estimate-workspace/tree-node';
import { RowName } from '@/components/shared/row-name';
import { addedAnnouncement, hasRowName, NO_DESCRIPTION_YET, rowNameOf } from '@/lib/estimates/row-name';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * AQP-446 (DEF-089; UX ruling `docs/03-ux/rulings/parts-tree-scr05-conformance-2026-11-26.md` item 1, checks NAME-1 to NAME-3 and NAME-5): a row shows its Description, else its Part No. (both come
 * from the server as `label`), else the kind's own name, muted and italic, with `, no description yet` for a screen reader. Every ID and name is invented.
 */

const item = (overrides: Partial<PartItem> = {}): PartItem => ({ id: 'r1', parentId: null, slNo: '1.1', label: '', nodeKind: 'SUB_ASSEMBLY', completeness: 'EMPTY', revision: 1, ...overrides });
const row = (node: PartItem, kindLabel: string): string => renderToStaticMarkup(createElement(TreeNode, { part: node, kindLabel, selected: false, onChoose: () => undefined }));

describe('the name of a row (NAME-1 to NAME-3)', () => {
  it('is the label the server sends (Description, else Part No.) when there is one', () => {
    expect(rowNameOf('Base frame', 'Sub-Assembly')).toBe('Base frame');
    expect(rowNameOf('XP-1101', 'Part')).toBe('XP-1101');
    expect(hasRowName('Base frame')).toBe(true);
  });

  it('is the kind\'s own name when there is no label, and a label of only spaces counts as none', () => {
    expect(rowNameOf('', 'Sub-Assembly')).toBe('Sub-Assembly');
    expect(rowNameOf('   ', 'Fastener')).toBe('Fastener');
    expect(hasRowName('')).toBe(false);
    expect(hasRowName('  ')).toBe(false);
  });

  it('follows the Part / Sub-part rule, because the kind label it is given does', () => {
    expect(rowNameOf('', 'Sub-part')).toBe('Sub-part');
  });
});

describe('RowName draws the name', () => {
  it('draws a typed name as plain text, with no muted look and no screen-reader suffix', () => {
    const html = renderToStaticMarkup(createElement(RowName, { label: 'Base frame', kindLabel: 'Sub-Assembly' }));
    expect(html).toBe('Base frame');
  });

  it('draws the kind\'s name muted (--ink-2), italic and at normal weight, with the suffix for a screen reader only', () => {
    const html = renderToStaticMarkup(createElement(RowName, { label: '', kindLabel: 'Sub-Assembly' }));
    expect(html).toContain('text-ink-2');
    expect(html).toContain('italic');
    expect(html).toContain('font-normal');
    expect(html).not.toContain('text-ink-3');
    expect(html).toContain(`<span class="sr-only">${NO_DESCRIPTION_YET}</span>`);
    expect(html.replace(/<[^>]*>/g, '')).toBe(`Sub-Assembly${NO_DESCRIPTION_YET}`);
  });

  it('says what the suffix says, in the words of the ruling', () => {
    expect(NO_DESCRIPTION_YET).toBe(', no description yet');
  });
});

describe('the tree row (NAME-1, NAME-3, NAME-5)', () => {
  it('shows the typed name and never the word "Part" for a row that has one', () => {
    const html = row(item({ label: 'Base frame', nodeKind: 'PART' }), 'Part');
    expect(html).toContain('Base frame');
    expect(html).not.toContain('no description yet');
    // The kind is still the icon's spoken name; the row's own text is the name.
    expect(html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]*>/g, ' ')).not.toMatch(/\bPart\b/);
  });

  it('shows the Part No. the server sends as the label', () => {
    expect(row(item({ label: 'XP-1101', nodeKind: 'PART' }), 'Part')).toContain('XP-1101');
  });

  it.each([
    ['MAIN_ASSEMBLY', 'Main Assembly'],
    ['SUB_ASSEMBLY', 'Sub-Assembly'],
    ['PART', 'Part'],
    ['PART', 'Sub-part'],
    ['FASTENER', 'Fastener'],
  ] as const)('shows the kind\'s own name for an unnamed %s (%s), muted, with the suffix for a screen reader', (nodeKind, kindLabel) => {
    const html = row(item({ nodeKind }), kindLabel);
    const text = html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]*>/g, '');
    expect(text).toContain(`${kindLabel}${NO_DESCRIPTION_YET}`);
    expect(html).toContain('italic');
    expect(html).toContain('text-ink-2');
  });

  it('reads the number, then the name and its suffix, then the status', () => {
    const text = row(item({ slNo: '1.1' }), 'Sub-Assembly').replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]*>/g, '|');
    expect(text.replace(/\|+/g, '|')).toContain('|1.1|Sub-Assembly|, no description yet|');
  });
});

describe('the words after an add (TB-5, NAME announcements)', () => {
  const rows = (...kinds: Array<[string, string | null, PartItem['nodeKind']]>): PartItem[] => kinds.map(([id, parentId, nodeKind], index) => item({ id, parentId, nodeKind, slNo: `1.${index + 1}` }));

  it('says what was added, and that a Description names it', () => {
    const before = rows(['m', null, 'MAIN_ASSEMBLY']);
    const after = [item({ id: 'm', slNo: '1', nodeKind: 'MAIN_ASSEMBLY' }), item({ id: 'p', parentId: 'm', slNo: '1.1', nodeKind: 'PART' })];
    expect(addedAnnouncement(before, after, 'p')).toBe('Added 1.1 Part. Type a Description to name it.');
  });

  it('names the kind that was added, not always Part', () => {
    const before = [item({ id: 'm', slNo: '1', nodeKind: 'MAIN_ASSEMBLY' })];
    const after = [...before, item({ id: 's', parentId: 'm', slNo: '1.1', nodeKind: 'SUB_ASSEMBLY' })];
    expect(addedAnnouncement(before, after, 's')).toBe('Added 1.1 Sub-Assembly. Type a Description to name it.');
  });

  it('adds which earlier row is now a Sub-part when the add made a second Part under the same parent', () => {
    const main = item({ id: 'm', slNo: '1', nodeKind: 'MAIN_ASSEMBLY' });
    const first = item({ id: 'p1', parentId: 'm', slNo: '1.1', nodeKind: 'PART' });
    const second = item({ id: 'p2', parentId: 'm', slNo: '1.2', nodeKind: 'PART' });
    expect(addedAnnouncement([main, first], [main, first, second], 'p2')).toBe('Added 1.2 Sub-part. Type a Description to name it. 1.1 is now a Sub-part.');
  });

  it('says nothing of a Sub-part when the row that was already a Sub-part stays one', () => {
    const main = item({ id: 'm', slNo: '1', nodeKind: 'MAIN_ASSEMBLY' });
    const parts = ['p1', 'p2', 'p3'].map((id, index) => item({ id, parentId: 'm', slNo: `1.${index + 1}`, nodeKind: 'PART' }));
    const [one, two, three] = parts as [PartItem, PartItem, PartItem];
    expect(addedAnnouncement([main, one, two], [main, one, two, three], 'p3')).toBe('Added 1.3 Sub-part. Type a Description to name it.');
  });
});
