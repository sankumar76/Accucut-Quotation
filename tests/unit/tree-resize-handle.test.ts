import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TreeResizeHandle } from '@/components/features/estimate-workspace/tree-resize-handle';
import type { TreeWidth } from '@/components/features/estimate-workspace/use-tree-width';

/**
 * AQP-426 re-land (DL-389 (4)(a); ux-expert note 90e23166; AC-2, AC-9, AC-10): the structure of the handle, read from its markup. The focusable element must be the one that draws the focus ring
 * (the Nightly sweep asks the focused element, or one of three ancestors, for an outline: DEF-086), so the focusable `separator` is a 24 x 48 box (44 x 48 with a coarse pointer) with the grip in it, and
 * the full-height hit area around it is a separate wrapper with the pointer handlers, no role and no tab stop. A static render has no browser, so classes and attributes are the contract; the behaviour
 * (a press focuses the separator, the ring is drawn and not clipped, the hit area is measured) is `tests/e2e/estimate-tree-width.spec.ts`. Every ID and name is invented.
 */

const resize: TreeWidth = { width: 320, ceiling: 400, workspaceWidth: 1000, preview: () => undefined, commit: () => undefined };
const html = renderToStaticMarkup(createElement(TreeResizeHandle, { resize, announce: () => undefined }));

const openingTag = (marker: RegExp): string => html.match(marker)?.[0] ?? '';
const separator = openingTag(/<div[^>]*role="separator"[^>]*>/);
const wrapper = openingTag(/<div[^>]*data-tree-hit=""[^>]*>/);
const classesOf = (tag: string): string[] => (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter((name) => name !== '');

describe('the focusable separator (AC-2, AC-9)', () => {
  it('is exactly one element, a div with a tab stop, and it carries the ARIA of the handle', () => {
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(separator).toMatch(/^<div /);
    expect(separator).toContain('tabindex="0"');
    for (const attribute of ['aria-orientation="vertical"', 'aria-label="Resize parts tree"', 'aria-controls="parts-tree-column"', 'aria-valuenow="320"', 'aria-valuemin="240"', 'aria-valuemax="400"', 'aria-valuetext="Parts tree 320 pixels wide"', 'aria-describedby="parts-tree-resize-hint"']) {
      expect(separator, attribute).toContain(attribute);
    }
  });

  it('is the 24 x 48 box (44 x 48 with a coarse pointer) that the ring is drawn on, and suppresses nothing: the global 3 px --focus ring with 2 px offset is the one that shows', () => {
    const names = classesOf(separator);
    expect(names).toEqual(expect.arrayContaining(['w-s-5', 'h-[48px]', 'pointer-coarse:w-[44px]']));
    expect(names.filter((name) => name.includes('outline')), 'no outline utility on the separator, so the global :focus-visible ring is used').toEqual([]);
  });

  it('holds the 4 x 40 px grip, and no pill is drawn behind it', () => {
    const inside = html.slice(html.indexOf(separator));
    expect(inside).toContain('data-tree-grip=""');
    expect(classesOf(openingTag(/<span[^>]*data-tree-grip=""[^>]*>/))).toEqual(expect.arrayContaining(['h-[40px]', 'w-[4px]', 'bg-border-strong']));
    expect(html).not.toContain('w-[12px]');
  });
});

describe('the hit-area wrapper (AC-3, AC-10)', () => {
  it('is a div with no role, no tab stop and no ARIA, so it is not a second control', () => {
    expect(wrapper).toMatch(/^<div /);
    for (const attribute of ['role=', 'tabindex=', 'aria-']) expect(wrapper, attribute).not.toContain(attribute);
  });

  it('is the full height of the column, 24 px wide (44 px with a coarse pointer, reaching 28 px into the card), with touch-action none and the resize cursor', () => {
    const names = classesOf(wrapper);
    expect(names).toEqual(expect.arrayContaining(['absolute', 'top-0', 'bottom-0', 'left-full', 'w-s-5', 'touch-none', 'cursor-col-resize', 'pointer-coarse:left-[calc(100%_-_28px)]', 'pointer-coarse:w-[44px]']));
  });

  it('contains the separator (the pointer reaches the wrapper through it) and not the other way round', () => {
    expect(html.indexOf(wrapper)).toBeLessThan(html.indexOf(separator));
  });
});
